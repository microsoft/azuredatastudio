/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as sinon from 'sinon';
import * as dataworkspace from 'dataworkspace';
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';
import * as testUtils from './testUtils';
import * as constants from '../common/constants';
import * as mssql from '../../../mssql';
import * as utils from '../common/utils';

import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { promises as fs } from 'fs';
import { createContext, TestContext, mockDacFxResult, mockConnectionProfile } from './testContext';
import { Project, reservedProjectFolders, SystemDatabase, FileProjectEntry, SystemDatabaseReferenceProjectEntry, EntryType } from '../models/project';
import { PublishDatabaseDialog } from '../dialogs/publishDatabaseDialog';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { FolderNode, FileNode } from '../models/tree/fileFolderTreeItem';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { AddDatabaseReferenceDialog } from '../dialogs/addDatabaseReferenceDialog';
import { IDacpacReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { CreateProjectFromDatabaseDialog } from '../dialogs/createProjectFromDatabaseDialog';
import { ImportDataModel } from '../models/api/import';
import { SqlTargetPlatform } from 'sqldbproj';

let testContext: TestContext;

describe('ProjectsController', function (): void {
	before(async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	beforeEach(function (): void {
		testContext = createContext();
	});

	afterEach(function (): void {
		sinon.restore();
	});

	describe('project controller operations', function (): void {
		describe('Project file operations and prompting', function (): void {
			it('Should create new sqlproj file with correct values', async function (): Promise<void> {
				const projController = new ProjectsController(testContext.outputChannel);
				const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

				const projFilePath = await projController.createNewProject({
					newProjName: 'TestProjectName',
					folderUri: vscode.Uri.file(projFileDir),
					projectTypeId: constants.emptySqlDatabaseProjectTypeId,
					projectGuid: 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575'
				});

				let projFileText = (await fs.readFile(projFilePath)).toString();

				should(projFileText).equal(baselines.newProjectFileBaseline);
			});

			it('Should create new sqlproj file with correct specified target platform', async function (): Promise<void> {
				const projController = new ProjectsController(testContext.outputChannel);
				const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);
				const projTargetPlatform = SqlTargetPlatform.sqlAzure; // default is SQL Server 2019

				const projFilePath = await projController.createNewProject({
					newProjName: 'TestProjectName',
					folderUri: vscode.Uri.file(projFileDir),
					projectTypeId: constants.emptySqlDatabaseProjectTypeId,
					projectGuid: 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575',
					targetPlatform: projTargetPlatform
				});

				const project = await Project.openProject(projFilePath);
				const projTargetVersion = project.getProjectTargetVersion();
				should(constants.getTargetPlatformFromVersion(projTargetVersion)).equal(projTargetPlatform);
			});


			it('Should return silently when no SQL object name provided in prompts', async function (): Promise<void> {
				for (const name of ['', '    ', undefined]) {
					const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves(name);
					const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
					const projController = new ProjectsController(testContext.outputChannel);
					const project = new Project('FakePath');

					should(project.files.length).equal(0);
					await projController.addItemPrompt(new Project('FakePath'), '', templates.script);
					should(project.files.length).equal(0, 'Expected to return without throwing an exception or adding a file when an empty/undefined name is provided.');
					should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not have been called');
					showInputBoxStub.restore();
					showErrorMessageSpy.restore();
				}
			});

			it('Should show error if trying to add a file that already exists', async function (): Promise<void> {
				const tableName = 'table1';
				sinon.stub(vscode.window, 'showInputBox').resolves(tableName);
				const spy = sinon.spy(vscode.window, 'showErrorMessage');
				const projController = new ProjectsController(testContext.outputChannel);
				const project = await testUtils.createTestProject(baselines.newProjectFileBaseline);

				should(project.files.length).equal(0, 'There should be no files');
				await projController.addItemPrompt(project, '', templates.script);
				should(project.files.length).equal(1, 'File should be successfully added');
				await projController.addItemPrompt(project, '', templates.script);
				const msg = constants.fileAlreadyExists(tableName);
				should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once');
				should(spy.calledWith(msg)).be.true(`showErrorMessage not called with expected message '${msg}' Actual '${spy.getCall(0).args[0]}'`);
			});

			it('Should show error if trying to add a folder that already exists', async function (): Promise<void> {
				const folderName = 'folder1';
				const stub = sinon.stub(vscode.window, 'showInputBox').resolves(folderName);

				const projController = new ProjectsController(testContext.outputChannel);
				const project = await testUtils.createTestProject(baselines.newProjectFileBaseline);
				const projectRoot = new ProjectRootTreeItem(project);

				should(project.files.length).equal(0, 'There should be no other folders');
				await projController.addFolderPrompt(createWorkspaceTreeItem(projectRoot));
				should(project.files.length).equal(1, 'Folder should be successfully added');
				stub.restore();
				await verifyFolderNotAdded(folderName, projController, project, projectRoot);

				// reserved folder names
				for (let i in reservedProjectFolders) {
					await verifyFolderNotAdded(reservedProjectFolders[i], projController, project, projectRoot);
				}
			});

			it('Should be able to add folder with reserved name as long as not at project root', async function (): Promise<void> {
				const folderName = 'folder1';
				const stub = sinon.stub(vscode.window, 'showInputBox').resolves(folderName);

				const projController = new ProjectsController(testContext.outputChannel);
				const project = await testUtils.createTestProject(baselines.openProjectFileBaseline);
				const projectRoot = new ProjectRootTreeItem(project);

				// make sure it's ok to add these folders if they aren't where the reserved folders are at the root of the project
				let node = projectRoot.children.find(c => c.friendlyName === 'Tables');
				stub.restore();
				for (let i in reservedProjectFolders) {
					await verifyFolderAdded(reservedProjectFolders[i], projController, project, <BaseProjectTreeItem>node);
				}
			});

			async function verifyFolderAdded(folderName: string, projController: ProjectsController, project: Project, node: BaseProjectTreeItem): Promise<void> {
				const beforeFileCount = project.files.length;
				const stub = sinon.stub(vscode.window, 'showInputBox').resolves(folderName);
				await projController.addFolderPrompt(createWorkspaceTreeItem(node));
				should(project.files.length).equal(beforeFileCount + 1, `File count should be increased by one after adding the folder ${folderName}`);
				stub.restore();
			}

			async function verifyFolderNotAdded(folderName: string, projController: ProjectsController, project: Project, node: BaseProjectTreeItem): Promise<void> {
				const beforeFileCount = project.files.length;
				const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves(folderName);
				const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
				await projController.addFolderPrompt(createWorkspaceTreeItem(node));
				should(showErrorMessageSpy.calledOnce).be.true('showErrorMessage should have been called exactly once');
				const msg = constants.folderAlreadyExists(folderName);
				should(showErrorMessageSpy.calledWith(msg)).be.true(`showErrorMessage not called with expected message '${msg}' Actual '${showErrorMessageSpy.getCall(0).args[0]}'`);
				should(project.files.length).equal(beforeFileCount, 'File count should be the same as before the folder was attempted to be added');
				showInputBoxStub.restore();
				showErrorMessageSpy.restore();
			}

			it('Should delete nested ProjectEntry from node', async function (): Promise<void> {
				let proj = await testUtils.createTestProject(templates.newSqlProjectTemplate);

				const setupResult = await setupDeleteExcludeTest(proj);
				const scriptEntry = setupResult[0], projTreeRoot = setupResult[1], preDeployEntry = setupResult[2], postDeployEntry = setupResult[3], noneEntry = setupResult[4];

				const projController = new ProjectsController(testContext.outputChannel);

				await projController.delete(createWorkspaceTreeItem(projTreeRoot.children.find(x => x.friendlyName === 'UpperFolder')!.children[0]) /* LowerFolder */);
				await projController.delete(createWorkspaceTreeItem(projTreeRoot.children.find(x => x.friendlyName === 'anotherScript.sql')!));
				await projController.delete(createWorkspaceTreeItem(projTreeRoot.children.find(x => x.friendlyName === 'Script.PreDeployment1.sql')!));
				await projController.delete(createWorkspaceTreeItem(projTreeRoot.children.find(x => x.friendlyName === 'Script.PreDeployment2.sql')!));
				await projController.delete(createWorkspaceTreeItem(projTreeRoot.children.find(x => x.friendlyName === 'Script.PostDeployment1.sql')!));

				proj = await Project.openProject(proj.projectFilePath); // reload edited sqlproj from disk

				// confirm result
				should(proj.files.length).equal(1, 'number of file/folder entries'); // lowerEntry and the contained scripts should be deleted
				should(proj.files[0].relativePath).equal('UpperFolder\\');
				should(proj.preDeployScripts.length).equal(0);
				should(proj.postDeployScripts.length).equal(0);
				should(proj.noneDeployScripts.length).equal(0);

				should(await utils.exists(scriptEntry.fsUri.fsPath)).equal(false, 'script is supposed to be deleted');
				should(await utils.exists(preDeployEntry.fsUri.fsPath)).equal(false, 'pre-deployment script is supposed to be deleted');
				should(await utils.exists(postDeployEntry.fsUri.fsPath)).equal(false, 'post-deployment script is supposed to be deleted');
				should(await utils.exists(noneEntry.fsUri.fsPath)).equal(false, 'none entry pre-deployment script is supposed to be deleted');
			});

			it('Should delete database references', async function (): Promise<void> {
				// setup - openProject baseline has a system db reference to master
				const proj = await testUtils.createTestProject(baselines.openProjectFileBaseline);
				const projController = new ProjectsController(testContext.outputChannel);
				sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.yesString));

				// add dacpac reference
				await proj.addDatabaseReference({
					dacpacFileLocation: vscode.Uri.file('test2.dacpac'),
					databaseName: 'test2DbName',
					databaseVariable: 'test2Db',
					suppressMissingDependenciesErrors: false
				});
				// add project reference
				await proj.addProjectReference({
					projectName: 'project1',
					projectGuid: '',
					projectRelativePath: vscode.Uri.file(path.join('..', 'project1', 'project1.sqlproj')),
					suppressMissingDependenciesErrors: false
				});

				const projTreeRoot = new ProjectRootTreeItem(proj);
				should(proj.databaseReferences.length).equal(3, 'Should start with 3 database references');

				const databaseReferenceNodeChildren = projTreeRoot.children.find(x => x.friendlyName === constants.databaseReferencesNodeName)?.children;
				await projController.delete(createWorkspaceTreeItem(databaseReferenceNodeChildren?.find(x => x.friendlyName === 'master')!));   // system db reference
				await projController.delete(createWorkspaceTreeItem(databaseReferenceNodeChildren?.find(x => x.friendlyName === 'test2')!));    // dacpac reference
				await projController.delete(createWorkspaceTreeItem(databaseReferenceNodeChildren?.find(x => x.friendlyName === 'project1')!)); // project reference

				// confirm result
				should(proj.databaseReferences.length).equal(0, 'All database references should have been deleted');
			});

			it('Should exclude nested ProjectEntry from node', async function (): Promise<void> {
				let proj = await testUtils.createTestProject(templates.newSqlProjectTemplate);
				const setupResult = await setupDeleteExcludeTest(proj);
				const scriptEntry = setupResult[0], projTreeRoot = setupResult[1], preDeployEntry = setupResult[2], postDeployEntry = setupResult[3], noneEntry = setupResult[4];

				const projController = new ProjectsController(testContext.outputChannel);

				await projController.exclude(createWorkspaceTreeItem(<FolderNode>projTreeRoot.children.find(x => x.friendlyName === 'UpperFolder')!.children[0]) /* LowerFolder */);
				await projController.exclude(createWorkspaceTreeItem(<FileNode>projTreeRoot.children.find(x => x.friendlyName === 'anotherScript.sql')!));
				await projController.exclude(createWorkspaceTreeItem(<FileNode>projTreeRoot.children.find(x => x.friendlyName === 'Script.PreDeployment1.sql')!));
				await projController.exclude(createWorkspaceTreeItem(<FileNode>projTreeRoot.children.find(x => x.friendlyName === 'Script.PreDeployment2.sql')!));
				await projController.exclude(createWorkspaceTreeItem(<FileNode>projTreeRoot.children.find(x => x.friendlyName === 'Script.PostDeployment1.sql')!));

				proj = await Project.openProject(proj.projectFilePath); // reload edited sqlproj from disk

				// confirm result
				should(proj.files.length).equal(1, 'number of file/folder entries'); // LowerFolder and the contained scripts should be deleted
				should(proj.files[0].relativePath).equal('UpperFolder\\'); // UpperFolder should still be there
				should(proj.preDeployScripts.length).equal(0);
				should(proj.postDeployScripts.length).equal(0);
				should(proj.noneDeployScripts.length).equal(0);

				should(await utils.exists(scriptEntry.fsUri.fsPath)).equal(true, 'script is supposed to still exist on disk');
				should(await utils.exists(preDeployEntry.fsUri.fsPath)).equal(true, 'pre-deployment script is supposed to still exist on disk');
				should(await utils.exists(postDeployEntry.fsUri.fsPath)).equal(true, 'post-deployment script is supposed to still exist on disk');
				should(await utils.exists(noneEntry.fsUri.fsPath)).equal(true, 'none entry pre-deployment script is supposed to still exist on disk');
			});

			it('Should delete folders with excluded items', async function (): Promise<void> {
				let proj = await testUtils.createTestProject(templates.newSqlProjectTemplate);
				const setupResult = await setupDeleteExcludeTest(proj);

				const scriptEntry = setupResult[0], projTreeRoot = setupResult[1];
				const upperFolder = projTreeRoot.children.find(x => x.friendlyName === 'UpperFolder')!;
				const lowerFolder = upperFolder.children.find(x => x.friendlyName === 'LowerFolder')!;

				const projController = new ProjectsController(testContext.outputChannel);

				// Exclude files under LowerFolder
				await projController.exclude(createWorkspaceTreeItem(<FileNode>lowerFolder.children.find(x => x.friendlyName === 'someScript.sql')!));
				await projController.exclude(createWorkspaceTreeItem(<FileNode>lowerFolder.children.find(x => x.friendlyName === 'someOtherScript.sql')!));

				// Delete UpperFolder
				await projController.delete(createWorkspaceTreeItem(<FolderNode>projTreeRoot.children.find(x => x.friendlyName === 'UpperFolder')!));

				// Reload edited sqlproj from disk
				proj = await Project.openProject(proj.projectFilePath);

				// Confirm result
				should(proj.files.some(x => x.relativePath === 'UpperFolder')).equal(false, 'UpperFolder should not be part of proj file any more');
				should(await utils.exists(scriptEntry.fsUri.fsPath)).equal(false, 'script is supposed to be deleted from disk');
				should(await utils.exists(lowerFolder.projectUri.fsPath)).equal(false, 'LowerFolder is supposed to be deleted from disk');
				should(await utils.exists(upperFolder.projectUri.fsPath)).equal(false, 'UpperFolder is supposed to be deleted from disk');
			});

			it('Should reload correctly after changing sqlproj file', async function (): Promise<void> {
				// create project
				const folderPath = await testUtils.generateTestFolderPath();
				const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline, folderPath);
				const treeProvider = new SqlDatabaseProjectTreeViewProvider();
				const projController = new ProjectsController(testContext.outputChannel);
				const project = await Project.openProject(vscode.Uri.file(sqlProjPath).fsPath);
				treeProvider.load([project]);

				// change the sql project file
				await fs.writeFile(sqlProjPath, baselines.newProjectFileWithScriptBaseline);
				should(project.files.length).equal(0);

				// call reload project
				await projController.reloadProject({ treeDataProvider: treeProvider, element: { root: { project: project } } });
				// calling this because this gets called in the projectProvider.getProjectTreeDataProvider(), which is called by workspaceTreeDataProvider
				// when notifyTreeDataChanged() happens
				treeProvider.load([project]);

				// check that the new project is in the tree
				should(project.files.length).equal(1);
				should(treeProvider.getChildren()[0].children.find(c => c.friendlyName === 'Script1.sql')).not.equal(undefined);
			});

			it('Should be able to add pre deploy and post deploy script', async function (): Promise<void> {
				const preDeployScriptName = 'PreDeployScript1.sql';
				const postDeployScriptName = 'PostDeployScript1.sql';

				const projController = new ProjectsController(testContext.outputChannel);
				const project = await testUtils.createTestProject(baselines.newProjectFileBaseline);

				sinon.stub(vscode.window, 'showInputBox').resolves(preDeployScriptName);
				should(project.preDeployScripts.length).equal(0, 'There should be no pre deploy scripts');
				await projController.addItemPrompt(project, '', templates.preDeployScript);
				should(project.preDeployScripts.length).equal(1, `Pre deploy script should be successfully added. ${project.preDeployScripts.length}, ${project.files.length}`);

				sinon.restore();
				sinon.stub(vscode.window, 'showInputBox').resolves(postDeployScriptName);
				should(project.postDeployScripts.length).equal(0, 'There should be no post deploy scripts');
				await projController.addItemPrompt(project, '', templates.postDeployScript);
				should(project.postDeployScripts.length).equal(1, 'Post deploy script should be successfully added');
			});

			it('Should change target platform', async function (): Promise<void> {
				sinon.stub(vscode.window, 'showQuickPick').resolves({ label: SqlTargetPlatform.sqlAzure });

				const projController = new ProjectsController(testContext.outputChannel);
				const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline);
				const project = await Project.openProject(sqlProjPath);
				should(project.getProjectTargetVersion()).equal(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2019));
				should(project.databaseReferences.length).equal(1, 'Project should have one database reference to master');
				should(project.databaseReferences[0].fsUri.fsPath).containEql(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2019));
				should((<SystemDatabaseReferenceProjectEntry>project.databaseReferences[0]).ssdtUri.fsPath).containEql(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2019));

				await projController.changeTargetPlatform(project);
				should(project.getProjectTargetVersion()).equal(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure));
				// verify system db reference got updated too
				should(project.databaseReferences[0].fsUri.fsPath).containEql(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure));
				should((<SystemDatabaseReferenceProjectEntry>project.databaseReferences[0]).ssdtUri.fsPath).containEql(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure));
			});
		});

		describe('Publishing and script generation', function (): void {
			it('Publish dialog should open from ProjectController', async function (): Promise<void> {
				let opened = false;

				let publishDialog = TypeMoq.Mock.ofType(PublishDatabaseDialog);
				publishDialog.setup(x => x.openDialog()).returns(() => { opened = true; });

				let projController = TypeMoq.Mock.ofType(ProjectsController);
				projController.callBase = true;
				projController.setup(x => x.getPublishDialog(TypeMoq.It.isAny())).returns(() => publishDialog.object);

				projController.object.publishProject(new Project('FakePath'));
				should(opened).equal(true);
			});

			it('Callbacks are hooked up and called from Publish dialog', async function (): Promise<void> {
				const projPath = path.dirname(await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline));
				await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, projPath);
				const proj = new Project(projPath);

				const publishHoller = 'hello from callback for publish()';
				const generateHoller = 'hello from callback for generateScript()';

				let holler = 'nothing';

				let publishDialog = TypeMoq.Mock.ofType(PublishDatabaseDialog, undefined, undefined, proj);
				publishDialog.callBase = true;
				publishDialog.setup(x => x.getConnectionUri()).returns(() => Promise.resolve('fake|connection|uri'));

				let projController = TypeMoq.Mock.ofType(ProjectsController);
				projController.callBase = true;
				projController.setup(x => x.getPublishDialog(TypeMoq.It.isAny())).returns(() => publishDialog.object);
				projController.setup(x => x.publishOrScriptProject(TypeMoq.It.isAny(), TypeMoq.It.isAny(), true)).returns(() => {
					holler = publishHoller;
					return Promise.resolve(undefined);
				});

				projController.setup(x => x.publishOrScriptProject(TypeMoq.It.isAny(), TypeMoq.It.isAny(), false)).returns(() => {
					holler = generateHoller;
					return Promise.resolve(undefined);
				});

				let dialog = projController.object.publishProject(proj);
				await dialog.publishClick();

				should(holler).equal(publishHoller, 'executionCallback() is supposed to have been setup and called for Publish scenario');

				dialog = projController.object.publishProject(proj);
				await dialog.generateScriptClick();

				should(holler).equal(generateHoller, 'executionCallback() is supposed to have been setup and called for GenerateScript scenario');
			});

			it('Should copy dacpac to temp folder before publishing', async function (): Promise<void> {
				const fakeDacpacContents = 'SwiftFlewHiawathasArrow';
				let postCopyContents = '';
				let builtDacpacPath = '';
				let publishedDacpacPath = '';

				testContext.dacFxService.setup(x => x.generateDeployScript(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async (p) => {
					publishedDacpacPath = p;
					postCopyContents = (await fs.readFile(publishedDacpacPath)).toString();
					return Promise.resolve(mockDacFxResult);
				});

				let projController = TypeMoq.Mock.ofType(ProjectsController);
				projController.callBase = true;

				projController.setup(x => x.buildProject(TypeMoq.It.isAny())).returns(async () => {
					builtDacpacPath = await testUtils.createTestFile(fakeDacpacContents, 'output.dacpac');
					return builtDacpacPath;
				});
				sinon.stub(utils, 'getDacFxService').resolves(testContext.dacFxService.object);

				const proj = await testUtils.createTestProject(baselines.openProjectFileBaseline);

				await projController.object.publishOrScriptProject(proj, { connectionUri: '', databaseName: '', serverName: '' }, false);

				should(builtDacpacPath).not.equal('', 'built dacpac path should be set');
				should(publishedDacpacPath).not.equal('', 'published dacpac path should be set');
				should(builtDacpacPath).not.equal(publishedDacpacPath, 'built and published dacpac paths should be different');
				should(postCopyContents).equal(fakeDacpacContents, 'contents of built and published dacpacs should match');
			});
		});
	});

	describe('Create project from database operations and dialog', function (): void {
		afterEach(() => {
			sinon.restore();
		});

		it('Should create list of all files and folders correctly', async function (): Promise<void> {
			const testFolderPath = await testUtils.createDummyFileStructure();

			const projController = new ProjectsController(testContext.outputChannel);
			const fileList = await projController.generateList(testFolderPath);

			should(fileList.length).equal(15);	// Parent folder + 2 files under parent folder + 2 directories with 5 files each
		});

		it('Should error out for inaccessible path', async function (): Promise<void> {
			const spy = sinon.spy(vscode.window, 'showErrorMessage');

			let testFolderPath = await testUtils.generateTestFolderPath();
			testFolderPath += '_nonexistentFolder';	// Modify folder path to point to a nonexistent location

			const projController = new ProjectsController(testContext.outputChannel);

			await projController.generateList(testFolderPath);
			should(spy.calledOnce).be.true('showErrorMessage should have been called');
			const msg = constants.cannotResolvePath(testFolderPath);
			should(spy.calledWith(msg)).be.true(`showErrorMessage not called with expected message '${msg}' Actual '${spy.getCall(0).args[0]}'`);
		});

		it('Create project from Database dialog should open from ProjectController', async function (): Promise<void> {
			let opened = false;

			let createProjectFromDatabaseDialog = TypeMoq.Mock.ofType(CreateProjectFromDatabaseDialog, undefined, undefined, mockConnectionProfile);
			createProjectFromDatabaseDialog.setup(x => x.openDialog()).returns(() => { opened = true; return Promise.resolve(undefined); });

			let projController = TypeMoq.Mock.ofType(ProjectsController);
			projController.callBase = true;
			projController.setup(x => x.getCreateProjectFromDatabaseDialog(TypeMoq.It.isAny())).returns(() => createProjectFromDatabaseDialog.object);

			await projController.object.createProjectFromDatabase(mockConnectionProfile);
			should(opened).equal(true);
		});

		it.skip('Callbacks are hooked up and called from create project from database dialog', async function (): Promise<void> {
			const createProjectFromDbHoller = 'hello from callback for createProjectFromDatabase()';

			let holler = 'nothing';

			const createProjectFromDatabaseDialog = TypeMoq.Mock.ofType(CreateProjectFromDatabaseDialog, undefined, undefined, undefined);
			createProjectFromDatabaseDialog.callBase = true;
			createProjectFromDatabaseDialog.setup(x => x.handleCreateButtonClick()).returns(async () => {
				await projController.object.createProjectFromDatabaseCallback({
					connectionUri: 'My Id',
					database: 'My Database',
					projName: 'testProject',
					filePath: 'testLocation',
					version: '1.0.0.0',
					extractTarget: mssql.ExtractTarget['schemaObjectType']
				});

				return Promise.resolve(undefined);
			});

			const projController = TypeMoq.Mock.ofType(ProjectsController);
			projController.callBase = true;
			projController.setup(x => x.getCreateProjectFromDatabaseDialog(TypeMoq.It.isAny())).returns(() => createProjectFromDatabaseDialog.object);
			projController.setup(x => x.createProjectFromDatabaseCallback(TypeMoq.It.isAny())).returns(() => {
				holler = createProjectFromDbHoller;
				return Promise.resolve(undefined);
			});

			let dialog = await projController.object.createProjectFromDatabase(undefined);
			await dialog!.handleCreateButtonClick();

			should(holler).equal(createProjectFromDbHoller, 'executionCallback() is supposed to have been setup and called for create project from database scenario');
		});

		it('Should set model filePath correctly for ExtractType = File', async function (): Promise<void> {
			let folderPath = await testUtils.generateTestFolderPath();
			let projectName = 'My Project';
			let importPath;
			let model: ImportDataModel = { connectionUri: 'My Id', database: 'My Database', projName: projectName, filePath: folderPath, version: '1.0.0.0', extractTarget: mssql.ExtractTarget['file'] };

			const projController = new ProjectsController(testContext.outputChannel);
			projController.setFilePath(model);
			importPath = model.filePath;

			should(importPath.toUpperCase()).equal(vscode.Uri.file(path.join(folderPath, projectName + '.sql')).fsPath.toUpperCase(), `model.filePath should be set to a specific file for ExtractTarget === file, but was ${importPath}`);
		});

		it('Should set model filePath correctly for ExtractType = Schema/Object Type', async function (): Promise<void> {
			let folderPath = await testUtils.generateTestFolderPath();
			let projectName = 'My Project';
			let importPath;
			let model: ImportDataModel = { connectionUri: 'My Id', database: 'My Database', projName: projectName, filePath: folderPath, version: '1.0.0.0', extractTarget: mssql.ExtractTarget['schemaObjectType'] };

			const projController = new ProjectsController(testContext.outputChannel);
			projController.setFilePath(model);
			importPath = model.filePath;

			should(importPath.toUpperCase()).equal(vscode.Uri.file(path.join(folderPath)).fsPath.toUpperCase(), `model.filePath should be set to a folder for ExtractTarget !== file, but was ${importPath}`);
		});
	});

	describe('Add database reference', function (): void {
		it('Add database reference dialog should open from ProjectController', async function (): Promise<void> {
			let opened = false;

			let addDbReferenceDialog = TypeMoq.Mock.ofType(AddDatabaseReferenceDialog);
			addDbReferenceDialog.setup(x => x.openDialog()).returns(() => { opened = true; return Promise.resolve(undefined); });

			let projController = TypeMoq.Mock.ofType(ProjectsController);
			projController.callBase = true;
			projController.setup(x => x.getAddDatabaseReferenceDialog(TypeMoq.It.isAny())).returns(() => addDbReferenceDialog.object);

			await projController.object.addDatabaseReference(new Project('FakePath'));
			should(opened).equal(true);
		});

		it('Callbacks are hooked up and called from Add database reference dialog', async function (): Promise<void> {
			const projPath = path.dirname(await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline));
			const proj = new Project(projPath);

			const addDbRefHoller = 'hello from callback for addDatabaseReference()';

			let holler = 'nothing';

			const addDbReferenceDialog = TypeMoq.Mock.ofType(AddDatabaseReferenceDialog, undefined, undefined, proj);
			addDbReferenceDialog.callBase = true;
			addDbReferenceDialog.setup(x => x.addReferenceClick()).returns(() => {
				return projController.object.addDatabaseReferenceCallback(proj,
					{ systemDb: SystemDatabase.master, databaseName: 'master', suppressMissingDependenciesErrors: false },
					{ treeDataProvider: new SqlDatabaseProjectTreeViewProvider(), element: undefined });
			});
			addDbReferenceDialog.setup(x => x.openDialog()).returns(() => Promise.resolve());

			const projController = TypeMoq.Mock.ofType(ProjectsController);
			projController.callBase = true;
			projController.setup(x => x.getAddDatabaseReferenceDialog(TypeMoq.It.isAny())).returns(() => addDbReferenceDialog.object);
			projController.setup(x => x.addDatabaseReferenceCallback(TypeMoq.It.isAny(), TypeMoq.It.is((_): _ is IDacpacReferenceSettings => true), TypeMoq.It.isAny())).returns(() => {
				holler = addDbRefHoller;
				return Promise.resolve(undefined);
			});

			let dialog = await projController.object.addDatabaseReference(proj);
			await dialog!.addReferenceClick();

			should(holler).equal(addDbRefHoller, 'executionCallback() is supposed to have been setup and called for add database reference scenario');
		});

		it('Should not allow adding circular project references', async function (): Promise<void> {
			const projPath1 = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline);
			const projPath2 = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
			const projController = new ProjectsController(testContext.outputChannel);

			const project1 = await Project.openProject(vscode.Uri.file(projPath1).fsPath);
			const project2 = await Project.openProject(vscode.Uri.file(projPath2).fsPath);
			const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
			const dataWorkspaceMock = TypeMoq.Mock.ofType<dataworkspace.IExtension>();
			dataWorkspaceMock.setup(x => x.getProjectsInWorkspace(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve([vscode.Uri.file(project1.projectFilePath), vscode.Uri.file(project2.projectFilePath)]));
			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: dataWorkspaceMock.object });

			// add project reference from project1 to project2
			await projController.addDatabaseReferenceCallback(project1, {
				projectGuid: '',
				projectName: 'TestProject',
				projectRelativePath: undefined,
				suppressMissingDependenciesErrors: false
			},
				{ treeDataProvider: new SqlDatabaseProjectTreeViewProvider(), element: undefined });
			should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not have been called');

			// try to add circular reference
			await projController.addDatabaseReferenceCallback(project2, {
				projectGuid: '',
				projectName: 'TestProjectName',
				projectRelativePath: undefined,
				suppressMissingDependenciesErrors: false
			},
				{ treeDataProvider: new SqlDatabaseProjectTreeViewProvider(), element: undefined });
			should(showErrorMessageSpy.called).be.true('showErrorMessage should have been called');
		});

		it('Should add dacpac references as relative paths', async function (): Promise<void> {
			const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
			const projController = new ProjectsController(testContext.outputChannel);

			const project1 = await Project.openProject(vscode.Uri.file(projFilePath).fsPath);
			const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
			const dataWorkspaceMock = TypeMoq.Mock.ofType<dataworkspace.IExtension>();
			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: dataWorkspaceMock.object });

			// add dacpac reference to something in the same folder
			should(project1.databaseReferences.length).equal(0, 'There should not be any database references to start with');

			await projController.addDatabaseReferenceCallback(project1, {
				databaseName: <string>this.databaseNameTextbox?.value,
				dacpacFileLocation: vscode.Uri.file(path.join(path.dirname(projFilePath), 'sameFolderTest.dacpac')),
				suppressMissingDependenciesErrors: false
			},
				{ treeDataProvider: new SqlDatabaseProjectTreeViewProvider(), element: undefined });
			should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not have been called');
			should(project1.databaseReferences.length).equal(1, 'Dacpac reference should have been added');
			should(project1.databaseReferences[0].databaseName).equal('sameFolderTest');
			should(project1.databaseReferences[0].pathForSqlProj()).equal('sameFolderTest.dacpac');
			// make sure reference to sameFolderTest.dacpac was added to project file
			let projFileText = (await fs.readFile(projFilePath)).toString();
			should(projFileText).containEql('sameFolderTest.dacpac');

			// add dacpac reference to something in the a nested folder
			await projController.addDatabaseReferenceCallback(project1, {
				databaseName: <string>this.databaseNameTextbox?.value,
				dacpacFileLocation: vscode.Uri.file(path.join(path.dirname(projFilePath), 'refs', 'nestedFolderTest.dacpac')),
				suppressMissingDependenciesErrors: false
			},
				{ treeDataProvider: new SqlDatabaseProjectTreeViewProvider(), element: undefined });
			should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not have been called');
			should(project1.databaseReferences.length).equal(2, 'Another dacpac reference should have been added');
			should(project1.databaseReferences[1].databaseName).equal('nestedFolderTest');
			should(project1.databaseReferences[1].pathForSqlProj()).equal('refs\\nestedFolderTest.dacpac');
			// make sure reference to nestedFolderTest.dacpac was added to project file
			projFileText = (await fs.readFile(projFilePath)).toString();
			should(projFileText).containEql('refs\\nestedFolderTest.dacpac');

			// add dacpac reference to something in the a folder outside of the project
			await projController.addDatabaseReferenceCallback(project1, {
				databaseName: <string>this.databaseNameTextbox?.value,
				dacpacFileLocation: vscode.Uri.file(path.join(path.dirname(projFilePath), '..', 'someFolder', 'outsideFolderTest.dacpac')),
				suppressMissingDependenciesErrors: false
			},
				{ treeDataProvider: new SqlDatabaseProjectTreeViewProvider(), element: undefined });
			should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not have been called');
			should(project1.databaseReferences.length).equal(3, 'Another dacpac reference should have been added');
			should(project1.databaseReferences[2].databaseName).equal('outsideFolderTest');
			should(project1.databaseReferences[2].pathForSqlProj()).equal('..\\someFolder\\outsideFolderTest.dacpac');
			// make sure reference to outsideFolderTest.dacpac was added to project file
			projFileText = (await fs.readFile(projFilePath)).toString();
			should(projFileText).containEql('..\\someFolder\\outsideFolderTest.dacpac');
		});
	});

	describe('AutoRest generation', function (): void {
		it('Should create project from autorest-generated files', async function (): Promise<void> {
			const parentFolder = await testUtils.generateTestFolderPath();
			await testUtils.createDummyFileStructure();
			const specName = 'DummySpec.yaml';
			const newProjFolder = path.join(parentFolder, path.basename(specName, '.yaml'));
			let fileList: vscode.Uri[] = [];

			const projController = TypeMoq.Mock.ofType(ProjectsController);
			projController.callBase = true;

			projController.setup(x => x.selectAutorestSpecFile()).returns(async () => specName);
			projController.setup(x => x.selectAutorestProjectLocation(TypeMoq.It.isAny())).returns(async () => {
				await fs.mkdir(newProjFolder);

				return {
					newProjectFolder: newProjFolder,
					outputFolder: parentFolder,
					projectName: path.basename(specName, '.yaml')
				};
			});

			projController.setup(x => x.generateAutorestFiles(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => {
				await testUtils.createDummyFileStructure(true, fileList, newProjFolder);
				await testUtils.createTestFile('SELECT \'This is a post-deployment script\'', constants.autorestPostDeploymentScriptName, newProjFolder);
			});

			projController.setup(x => x.promptForAutorestProjectName(TypeMoq.It.isAny())).returns(async () => path.basename(specName, '.yaml'));
			projController.setup(x => x.openProjectInWorkspace(TypeMoq.It.isAny())).returns(async () => { });

			const project = (await projController.object.generateProjectFromOpenApiSpec())!;

			should(project.postDeployScripts.length).equal(1, `Expected 1 post-deployment script, got ${project?.postDeployScripts.length}`);
			const actual = path.basename(project.postDeployScripts[0].fsUri.fsPath);
			should(actual).equal(constants.autorestPostDeploymentScriptName, `Unexpected post-deployment script name: ${actual}, expected ${constants.autorestPostDeploymentScriptName}`);

			const expectedScripts = fileList.filter(f => path.extname(f.fsPath) === '.sql');
			should(project.files.filter(f => f.type === EntryType.File).length).equal(expectedScripts.length, 'Unexpected number of scripts in project');

			const expectedFolders = fileList.filter(f => path.extname(f.fsPath) === '' && f.fsPath.toUpperCase() !== newProjFolder.toUpperCase());
			should(project.files.filter(f => f.type === EntryType.Folder).length).equal(expectedFolders.length, 'Unexpected number of folders in project');
		});
	});
});

async function setupDeleteExcludeTest(proj: Project): Promise<[FileProjectEntry, ProjectRootTreeItem, FileProjectEntry, FileProjectEntry, FileProjectEntry]> {
	await proj.addFolderItem('UpperFolder');
	await proj.addFolderItem('UpperFolder/LowerFolder');
	const scriptEntry = await proj.addScriptItem('UpperFolder/LowerFolder/someScript.sql', 'not a real script');
	await proj.addScriptItem('UpperFolder/LowerFolder/someOtherScript.sql', 'Also not a real script');
	await proj.addScriptItem('../anotherScript.sql', 'Also not a real script');
	const preDeployEntry = await proj.addScriptItem('Script.PreDeployment1.sql', 'pre-deployment stuff', templates.preDeployScript);
	const noneEntry = await proj.addScriptItem('Script.PreDeployment2.sql', 'more pre-deployment stuff', templates.preDeployScript);
	const postDeployEntry = await proj.addScriptItem('Script.PostDeployment1.sql', 'post-deployment stuff', templates.postDeployScript);

	const projTreeRoot = new ProjectRootTreeItem(proj);
	sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.yesString));

	// confirm setup
	should(proj.files.length).equal(5, 'number of file/folder entries');
	should(proj.preDeployScripts.length).equal(1, 'number of pre-deployment script entries');
	should(proj.postDeployScripts.length).equal(1, 'number of post-deployment script entries');
	should(proj.noneDeployScripts.length).equal(1, 'number of none script entries');
	should(path.parse(scriptEntry.fsUri.fsPath).base).equal('someScript.sql');
	should((await fs.readFile(scriptEntry.fsUri.fsPath)).toString()).equal('not a real script');

	return [scriptEntry, projTreeRoot, preDeployEntry, postDeployEntry, noneEntry];
}

function createWorkspaceTreeItem(node: BaseProjectTreeItem): dataworkspace.WorkspaceTreeItem {
	return {
		element: node,
		treeDataProvider: new SqlDatabaseProjectTreeViewProvider()
	};
}

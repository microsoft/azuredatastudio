/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as sinon from 'sinon';
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';
import * as testUtils from './testUtils';
import * as constants from '../common/constants';

import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { promises as fs } from 'fs';
import { createContext, TestContext, mockDacFxResult } from './testContext';
import { Project, reservedProjectFolders, SystemDatabase, FileProjectEntry, SystemDatabaseReferenceProjectEntry } from '../models/project';
import { PublishDatabaseDialog } from '../dialogs/publishDatabaseDialog';
import { IPublishSettings, IGenerateScriptSettings } from '../models/IPublishSettings';
import { exists } from '../common/utils';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { FolderNode, FileNode } from '../models/tree/fileFolderTreeItem';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { AddDatabaseReferenceDialog } from '../dialogs/addDatabaseReferenceDialog';
import { IDacpacReferenceSettings } from '../models/IDatabaseReferenceSettings';

let testContext: TestContext;

// Mock test data
const mockConnectionProfile: azdata.IConnectionProfile = {
	connectionName: 'My Connection',
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: 'SqlLogin',
	savePassword: false,
	groupFullName: 'My groupName',
	groupId: 'My GroupId',
	providerName: 'My Server',
	saveProfile: true,
	id: 'My Id',
	options: undefined as any
};

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
				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
				const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

				const projFilePath = await projController.createNewProject('TestProjectName', vscode.Uri.file(projFileDir), false, 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575');

				let projFileText = (await fs.readFile(projFilePath)).toString();

				should(projFileText).equal(baselines.newProjectFileBaseline);
			});

			it('Should load Project and associated DataSources', async function (): Promise<void> {
				// setup test files
				const folderPath = await testUtils.generateTestFolderPath();
				const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline, folderPath);
				await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

				const project = await projController.openProject(vscode.Uri.file(sqlProjPath));

				should(project.files.length).equal(9); // detailed sqlproj tests in their own test file
				should(project.dataSources.length).equal(3); // detailed datasources tests in their own test file
			});

			it('Should load both project and referenced project', async function (): Promise<void> {
				// setup test projects
				const folderPath = await testUtils.generateTestFolderPath();
				await fs.mkdir(path.join(folderPath, 'proj1'));
				await fs.mkdir(path.join(folderPath, 'ReferencedProject'));

				const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.openProjectWithProjectReferencesBaseline, path.join(folderPath, 'proj1'));
				await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline, path.join(folderPath, 'ReferencedProject'));

				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
				await projController.openProject(vscode.Uri.file(sqlProjPath));

				should(projController.projects.length).equal(2, 'Referenced project should have been opened when the project referencing it was opened');
			});

			it('Should not keep failed to load project in project list.', async function (): Promise<void> {
				const folderPath = await testUtils.generateTestFolderPath();
				const sqlProjPath = await testUtils.createTestSqlProjFile('empty file with no valid xml', folderPath);
				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

				try {
					await projController.openProject(vscode.Uri.file(sqlProjPath));
					should.fail(null, null, 'The given project not expected to open');
				}
				catch {
					should(projController.projects.length).equal(0, 'The added project should be removed');
				}
			});

			it('Should return silently when no SQL object name provided in prompts', async function (): Promise<void> {
				for (const name of ['', '    ', undefined]) {
					const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves(name);
					const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
					const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
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
				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
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

				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
				const project = await testUtils.createTestProject(baselines.newProjectFileBaseline);
				const projectRoot = new ProjectRootTreeItem(project);

				should(project.files.length).equal(0, 'There should be no other folders');
				await projController.addFolderPrompt(projectRoot);
				should(project.files.length).equal(1, 'Folder should be successfully added');
				projController.refreshProjectsTree();
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

				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
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
				await projController.addFolderPrompt(node);
				should(project.files.length).equal(beforeFileCount + 1, `File count should be increased by one after adding the folder ${folderName}`);
				stub.restore();
			}

			async function verifyFolderNotAdded(folderName: string, projController: ProjectsController, project: Project, node: BaseProjectTreeItem): Promise<void> {
				const beforeFileCount = project.files.length;
				const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves(folderName);
				const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
				await projController.addFolderPrompt(node);
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

				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

				await projController.delete(projTreeRoot.children.find(x => x.friendlyName === 'UpperFolder')!.children[0] /* LowerFolder */);
				await projController.delete(projTreeRoot.children.find(x => x.friendlyName === 'anotherScript.sql')!);
				await projController.delete(projTreeRoot.children.find(x => x.friendlyName === 'Script.PreDeployment1.sql')!);
				await projController.delete(projTreeRoot.children.find(x => x.friendlyName === 'Script.PreDeployment2.sql')!);
				await projController.delete(projTreeRoot.children.find(x => x.friendlyName === 'Script.PostDeployment1.sql')!);

				proj = await Project.openProject(proj.projectFilePath); // reload edited sqlproj from disk

				// confirm result
				should(proj.files.length).equal(1, 'number of file/folder entries'); // lowerEntry and the contained scripts should be deleted
				should(proj.files[0].relativePath).equal('UpperFolder');
				should(proj.preDeployScripts.length).equal(0);
				should(proj.postDeployScripts.length).equal(0);
				should(proj.noneDeployScripts.length).equal(0);

				should(await exists(scriptEntry.fsUri.fsPath)).equal(false, 'script is supposed to be deleted');
				should(await exists(preDeployEntry.fsUri.fsPath)).equal(false, 'pre-deployment script is supposed to be deleted');
				should(await exists(postDeployEntry.fsUri.fsPath)).equal(false, 'post-deployment script is supposed to be deleted');
				should(await exists(noneEntry.fsUri.fsPath)).equal(false, 'none entry pre-deployment script is supposed to be deleted');
			});

			it('Should delete database references', async function (): Promise<void> {
				// setup - openProject baseline has a system db reference to master
				const proj = await testUtils.createTestProject(baselines.openProjectFileBaseline);
				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
				sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.yesString));

				// add dacpac reference
				proj.addDatabaseReference({
					dacpacFileLocation: vscode.Uri.file('test2.dacpac'),
					databaseName: 'test2DbName',
					databaseVariable: 'test2Db',
					suppressMissingDependenciesErrors: false
				});
				// add project reference
				proj.addProjectReference({
					projectName: 'project1',
					projectGuid: '',
					projectRelativePath: vscode.Uri.file(path.join('..', 'project1', 'project1.sqlproj')),
					suppressMissingDependenciesErrors: false
				});

				const projTreeRoot = new ProjectRootTreeItem(proj);
				should(proj.databaseReferences.length).equal(3, 'Should start with 3 database references');

				const databaseReferenceNodeChildren = projTreeRoot.children.find(x => x.friendlyName === constants.databaseReferencesNodeName)?.children;
				await projController.delete(databaseReferenceNodeChildren?.find(x => x.friendlyName === 'master')!);   // system db reference
				await projController.delete(databaseReferenceNodeChildren?.find(x => x.friendlyName === 'test2')!);    // dacpac reference
				await projController.delete(databaseReferenceNodeChildren?.find(x => x.friendlyName === 'project1')!); // project reference

				// confirm result
				should(proj.databaseReferences.length).equal(0, 'All database references should have been deleted');
			});

			it('Should exclude nested ProjectEntry from node', async function (): Promise<void> {
				let proj = await testUtils.createTestProject(templates.newSqlProjectTemplate);
				const setupResult = await setupDeleteExcludeTest(proj);
				const scriptEntry = setupResult[0], projTreeRoot = setupResult[1], preDeployEntry = setupResult[2], postDeployEntry = setupResult[3], noneEntry = setupResult[4];

				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

				await projController.exclude(<FolderNode>projTreeRoot.children.find(x => x.friendlyName === 'UpperFolder')!.children[0] /* LowerFolder */);
				await projController.exclude(<FileNode>projTreeRoot.children.find(x => x.friendlyName === 'anotherScript.sql')!);
				await projController.exclude(<FileNode>projTreeRoot.children.find(x => x.friendlyName === 'Script.PreDeployment1.sql')!);
				await projController.exclude(<FileNode>projTreeRoot.children.find(x => x.friendlyName === 'Script.PreDeployment2.sql')!);
				await projController.exclude(<FileNode>projTreeRoot.children.find(x => x.friendlyName === 'Script.PostDeployment1.sql')!);

				proj = await Project.openProject(proj.projectFilePath); // reload edited sqlproj from disk

				// confirm result
				should(proj.files.length).equal(1, 'number of file/folder entries'); // LowerFolder and the contained scripts should be deleted
				should(proj.files[0].relativePath).equal('UpperFolder'); // UpperFolder should still be there
				should(proj.preDeployScripts.length).equal(0);
				should(proj.postDeployScripts.length).equal(0);
				should(proj.noneDeployScripts.length).equal(0);

				should(await exists(scriptEntry.fsUri.fsPath)).equal(true, 'script is supposed to still exist on disk');
				should(await exists(preDeployEntry.fsUri.fsPath)).equal(true, 'pre-deployment script is supposed to still exist on disk');
				should(await exists(postDeployEntry.fsUri.fsPath)).equal(true, 'post-deployment script is supposed to still exist on disk');
				should(await exists(noneEntry.fsUri.fsPath)).equal(true, 'none entry pre-deployment script is supposed to still exist on disk');
			});

			it('Should reload correctly after changing sqlproj file', async function (): Promise<void> {
				// create project
				const folderPath = await testUtils.generateTestFolderPath();
				const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline, folderPath);
				const treeProvider = new SqlDatabaseProjectTreeViewProvider();
				const projController = new ProjectsController(treeProvider);
				const project = await projController.openProject(vscode.Uri.file(sqlProjPath));

				// change the sql project file
				await fs.writeFile(sqlProjPath, baselines.newProjectFileWithScriptBaseline);
				should(project.files.length).equal(0);

				// call reload project
				await projController.reloadProject(vscode.Uri.file(project.projectFilePath));
				should(project.files.length).equal(1);

				// check that the new project is in the tree
				should(treeProvider.getChildren()[0].children.find(c => c.friendlyName === 'Script1.sql')).not.equal(undefined);
			});

			it('Should be able to add pre deploy and post deploy script', async function (): Promise<void> {
				const preDeployScriptName = 'PreDeployScript1.sql';
				const postDeployScriptName = 'PostDeployScript1.sql';

				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
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
				sinon.stub(vscode.window, 'showQuickPick').resolves({ label: constants.sqlAzure });

				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
				const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline);
				const project = await projController.openProject(vscode.Uri.file(sqlProjPath));
				should(project.getProjectTargetVersion()).equal(constants.targetPlatformToVersion.get(constants.sqlServer2019));
				should(project.databaseReferences.length).equal(1, 'Project should have one database reference to master');
				should(project.databaseReferences[0].fsUri.fsPath).containEql(constants.targetPlatformToVersion.get(constants.sqlServer2019));
				should((<SystemDatabaseReferenceProjectEntry>project.databaseReferences[0]).ssdtUri.fsPath).containEql(constants.targetPlatformToVersion.get(constants.sqlServer2019));

				await projController.changeTargetPlatform(project);
				should(project.getProjectTargetVersion()).equal(constants.targetPlatformToVersion.get(constants.sqlAzure));
				// verify system db reference got updated too
				should(project.databaseReferences[0].fsUri.fsPath).containEql(constants.targetPlatformToVersion.get(constants.sqlAzure));
				should((<SystemDatabaseReferenceProjectEntry>project.databaseReferences[0]).ssdtUri.fsPath).containEql(constants.targetPlatformToVersion.get(constants.sqlAzure));
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

				await projController.object.publishProject(new Project('FakePath'));
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
				projController.setup(x => x.executionCallback(TypeMoq.It.isAny(), TypeMoq.It.is((_): _ is IPublishSettings => true))).returns(() => {
					holler = publishHoller;
					return Promise.resolve(undefined);
				});

				projController.setup(x => x.executionCallback(TypeMoq.It.isAny(), TypeMoq.It.is((_): _ is IGenerateScriptSettings => true))).returns(() => {
					holler = generateHoller;
					return Promise.resolve(undefined);
				});

				let dialog = await projController.object.publishProject(proj);
				await dialog.publishClick();

				should(holler).equal(publishHoller, 'executionCallback() is supposed to have been setup and called for Publish scenario');

				dialog = await projController.object.publishProject(proj);
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

				projController.setup(x => x.getDaxFxService()).returns(() => Promise.resolve(testContext.dacFxService.object));

				await projController.object.executionCallback(new Project(''), { connectionUri: '', databaseName: '' });

				should(builtDacpacPath).not.equal('', 'built dacpac path should be set');
				should(publishedDacpacPath).not.equal('', 'published dacpac path should be set');
				should(builtDacpacPath).not.equal(publishedDacpacPath, 'built and published dacpac paths should be different');
				should(postCopyContents).equal(fakeDacpacContents, 'contents of built and published dacpacs should match');
			});
		});
	});

	describe('import operations', function (): void {
		it('Should create list of all files and folders correctly', async function (): Promise<void> {
			const testFolderPath = await testUtils.createDummyFileStructure();

			const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
			const fileList = await projController.generateList(testFolderPath);

			should(fileList.length).equal(15);	// Parent folder + 2 files under parent folder + 2 directories with 5 files each
		});

		it('Should error out for inaccessible path', async function (): Promise<void> {
			const spy = sinon.spy(vscode.window, 'showErrorMessage');

			let testFolderPath = await testUtils.generateTestFolderPath();
			testFolderPath += '_nonexistentFolder';	// Modify folder path to point to a nonexistent location

			const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

			await projController.generateList(testFolderPath);
			should(spy.calledOnce).be.true('showErrorMessage should have been called');
			const msg = constants.cannotResolvePath(testFolderPath);
			should(spy.calledWith(msg)).be.true(`showErrorMessage not called with expected message '${msg}' Actual '${spy.getCall(0).args[0]}'`);
		});

		it('Should show error when no project name provided', async function (): Promise<void> {
			for (const name of ['', '    ', undefined]) {
				sinon.stub(vscode.window, 'showInputBox').resolves(name);
				const spy = sinon.spy(vscode.window, 'showErrorMessage');

				const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
				await projController.importNewDatabaseProject({ connectionProfile: mockConnectionProfile });
				should(spy.calledOnce).be.true('showErrorMessage should have been called');
				should(spy.calledWith(constants.projectNameRequired)).be.true(`showErrorMessage not called with expected message '${constants.projectNameRequired}' Actual '${spy.getCall(0).args[0]}'`);
				sinon.restore();
			}
		});

		it('Should show error when no target information provided', async function (): Promise<void> {
			sinon.stub(vscode.window, 'showInputBox').resolves('MyProjectName');
			sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);
			sinon.stub(vscode.window, 'showOpenDialog').resolves([vscode.Uri.file('fakePath')]);
			const spy = sinon.spy(vscode.window, 'showErrorMessage');

			const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
			await projController.importNewDatabaseProject({ connectionProfile: mockConnectionProfile });
			should(spy.calledOnce).be.true('showErrorMessage should have been called');
			should(spy.calledWith(constants.extractTargetRequired)).be.true(`showErrorMessage not called with expected message '${constants.extractTargetRequired}' Actual '${spy.getCall(0).args[0]}'`);
		});

		it('Should show error when no location provided with ExtractTarget = File', async function (): Promise<void> {
			sinon.stub(vscode.window, 'showInputBox').resolves('MyProjectName');
			sinon.stub(vscode.window, 'showOpenDialog').resolves(undefined);
			sinon.stub(vscode.window, 'showQuickPick').resolves({ label: constants.file });
			const spy = sinon.spy(vscode.window, 'showErrorMessage');

			const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
			await projController.importNewDatabaseProject({ connectionProfile: mockConnectionProfile });
			should(spy.calledOnce).be.true('showErrorMessage should have been called');
			should(spy.calledWith(constants.projectLocationRequired)).be.true(`showErrorMessage not called with expected message '${constants.projectLocationRequired}' Actual '${spy.getCall(0).args[0]}'`);
		});

		it('Should show error when no location provided with ExtractTarget = SchemaObjectType', async function (): Promise<void> {
			sinon.stub(vscode.window, 'showInputBox').resolves('MyProjectName');
			sinon.stub(vscode.window, 'showQuickPick').resolves({ label: constants.schemaObjectType });
			sinon.stub(vscode.window, 'showOpenDialog').resolves(undefined);
			const spy = sinon.spy(vscode.window, 'showErrorMessage');

			const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
			await projController.importNewDatabaseProject({ connectionProfile: mockConnectionProfile });
			should(spy.calledOnce).be.true('showErrorMessage should have been called');
			should(spy.calledWith(constants.projectLocationRequired)).be.true(`showErrorMessage not called with expected message '${constants.projectLocationRequired}' Actual '${spy.getCall(0).args[0]}'`);
		});

		it('Should set model filePath correctly for ExtractType = File and not-File.', async function (): Promise<void> {
			const projectName = 'MyProjectName';
			let folderPath = await testUtils.generateTestFolderPath();

			sinon.stub(vscode.window, 'showInputBox').resolves(projectName);
			const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves({ label: constants.file });
			sinon.stub(vscode.window, 'showOpenDialog').callsFake(() => Promise.resolve([vscode.Uri.file(folderPath)]));

			let importPath;

			let projController = TypeMoq.Mock.ofType(ProjectsController, undefined, undefined, new SqlDatabaseProjectTreeViewProvider());
			projController.callBase = true;

			projController.setup(x => x.importApiCall(TypeMoq.It.isAny())).returns(async (model) => { importPath = model.filePath; });

			await projController.object.importNewDatabaseProject({ connectionProfile: mockConnectionProfile });
			should(importPath).equal(vscode.Uri.file(path.join(folderPath, projectName, projectName + '.sql')).fsPath, `model.filePath should be set to a specific file for ExtractTarget === file, but was ${importPath}`);

			// reset for counter-test
			importPath = undefined;
			folderPath = await testUtils.generateTestFolderPath();
			showQuickPickStub.resolves({ label: constants.schemaObjectType });

			await projController.object.importNewDatabaseProject({ connectionProfile: mockConnectionProfile });
			should(importPath).equal(vscode.Uri.file(path.join(folderPath, projectName)).fsPath, `model.filePath should be set to a folder for ExtractTarget !== file, but was ${importPath}`);
		});

		it('Should establish Import context correctly for ObjectExplorer and palette launch points', async function (): Promise<void> {
			const connectionId = 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575';
			// test welcome button and palette launch points (context-less)
			let mockDbSelection = 'FakeDatabase';
			sinon.stub(azdata.connection, 'listDatabases').resolves([]);
			sinon.stub(vscode.window, 'showQuickPick').resolves({ label: mockDbSelection });
			sinon.stub(azdata.connection, 'openConnectionDialog').resolves({
				providerName: 'MSSQL',
				connectionId: connectionId,
				options: {}
			});

			let projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

			let result = await projController.getModelFromContext(undefined);

			should(result).deepEqual({ database: mockDbSelection, serverId: connectionId });

			// test launch via Object Explorer context
			result = await projController.getModelFromContext(mockConnectionProfile);
			should(result).deepEqual({ database: 'My Database', serverId: 'My Id' });
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
				projController.object.addDatabaseReferenceCallback(proj, { systemDb: SystemDatabase.master, databaseName: 'master', suppressMissingDependenciesErrors: false });
				return Promise.resolve(undefined);
			});

			const projController = TypeMoq.Mock.ofType(ProjectsController);
			projController.callBase = true;
			projController.setup(x => x.getAddDatabaseReferenceDialog(TypeMoq.It.isAny())).returns(() => addDbReferenceDialog.object);
			projController.setup(x => x.addDatabaseReferenceCallback(TypeMoq.It.isAny(), TypeMoq.It.is((_): _ is IDacpacReferenceSettings => true))).returns(() => {
				holler = addDbRefHoller;
				return Promise.resolve(undefined);
			});

			let dialog = await projController.object.addDatabaseReference(proj);
			await dialog.addReferenceClick();

			should(holler).equal(addDbRefHoller, 'executionCallback() is supposed to have been setup and called for add database reference scenario');
		});

		it('Should not allow adding circular project references', async function (): Promise<void> {
			const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');

			const projPath1 = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline);
			const projPath2 = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
			const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

			const project1 = await projController.openProject(vscode.Uri.file(projPath1));
			const project2 = await projController.openProject(vscode.Uri.file(projPath2));

			// add project reference from project1 to project2
			await projController.addDatabaseReferenceCallback(project1, {
				projectGuid: '',
				projectName: 'TestProject',
				projectRelativePath: undefined,
				suppressMissingDependenciesErrors: false
			});
			should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not have been called');

			// try to add circular reference
			await projController.addDatabaseReferenceCallback(project2, {
				projectGuid: '',
				projectName: 'TestProjectName',
				projectRelativePath: undefined,
				suppressMissingDependenciesErrors: false
			});
			should(showErrorMessageSpy.called).be.true('showErrorMessage should have been called');
		});

	});
});

describe.skip('ProjectsController: round trip feature with SSDT', function (): void {
	it('Should show warning message for SSDT project opened in Azure Data Studio', async function (): Promise<void> {
		const stub = sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.noString));

		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.SSDTProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

		await projController.openProject(vscode.Uri.file(sqlProjPath));
		should(stub.calledOnce).be.true('showWarningMessage should have been called exactly once');
		should(stub.calledWith(constants.updateProjectForRoundTrip)).be.true(`showWarningMessage not called with expected message '${constants.updateProjectForRoundTrip}' Actual '${stub.getCall(0).args[0]}'`);
	});

	it('Should not show warning message for non-SSDT projects that have the additional information for Build', async function (): Promise<void> {
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

		const project = await projController.openProject(vscode.Uri.file(sqlProjPath));	// no error thrown

		should(project.importedTargets.length).equal(3); // additional target should exist by default
	});

	it('Should not update project and no backup file should be created when update to project is rejected', async function (): Promise<void> {
		sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.noString));
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.SSDTProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

		const project = await projController.openProject(vscode.Uri.file(sqlProjPath));

		should(await exists(sqlProjPath + '_backup')).equal(false);	// backup file should not be generated
		should(project.importedTargets.length).equal(2); // additional target should not be added by updateProjectForRoundTrip method
	});

	it('Should load Project and associated import targets when update to project is accepted', async function (): Promise<void> {
		sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.yesString));

		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.SSDTProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());

		const project = await projController.openProject(vscode.Uri.file(sqlProjPath));

		should(await exists(sqlProjPath + '_backup')).equal(true);	// backup file should be generated before the project is updated
		should(project.importedTargets.length).equal(3); // additional target added by updateProjectForRoundTrip method
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

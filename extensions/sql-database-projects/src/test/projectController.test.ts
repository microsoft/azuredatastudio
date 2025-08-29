/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as sinon from 'sinon';
import * as dataworkspace from 'dataworkspace';
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';
import * as testUtils from './testUtils';
import * as constants from '../common/constants';
import * as mssql from 'mssql';
import * as utils from '../common/utils';

import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { promises as fs } from 'fs';
import { createContext, TestContext, mockDacFxResult, mockConnectionProfile } from './testContext';
import { Project } from '../models/project';
import { PublishDatabaseDialog } from '../dialogs/publishDatabaseDialog';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { FolderNode, FileNode } from '../models/tree/fileFolderTreeItem';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { AddDatabaseReferenceDialog } from '../dialogs/addDatabaseReferenceDialog';
import { IDacpacReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { CreateProjectFromDatabaseDialog } from '../dialogs/createProjectFromDatabaseDialog';
import { ImportDataModel } from '../models/api/import';
import { EntryType, ItemType, SqlTargetPlatform } from 'sqldbproj';
import { FileProjectEntry } from '../models/projectEntry';
import { SystemDatabase } from 'mssql';

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

	after(async function (): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	describe('project controller operations', function (): void {
		describe('Project file operations and prompting', function (): void {
			it('Should create new sqlproj file with correct specified target platform', async function (): Promise<void> {
				const projController = new ProjectsController(testContext.outputChannel);
				const projFileDir = await testUtils.generateTestFolderPath(this.test);
				const projTargetPlatform = SqlTargetPlatform.sqlAzure; // default is SQL Server 2022

				const projFilePath = await projController.createNewProject({
					newProjName: 'TestProjectName',
					folderUri: vscode.Uri.file(projFileDir),
					projectTypeId: constants.emptySqlDatabaseProjectTypeId,
					configureDefaultBuild: true,
					projectGuid: 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575',
					targetPlatform: projTargetPlatform,
					sdkStyle: false
				});

				const project = await Project.openProject(projFilePath);
				const projTargetVersion = project.getProjectTargetVersion();
				should(constants.getTargetPlatformFromVersion(projTargetVersion)).equal(projTargetPlatform);
			});

			it('Should create new edge project with expected template files', async function (): Promise<void> {
				const projController = new ProjectsController(testContext.outputChannel);
				const projFileDir = await testUtils.generateTestFolderPath(this.test);

				const projFilePath = await projController.createNewProject({
					newProjName: 'TestProjectName',
					folderUri: vscode.Uri.file(projFileDir),
					projectTypeId: constants.edgeSqlDatabaseProjectTypeId,
					configureDefaultBuild: true,
					projectGuid: 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575',
					sdkStyle: true
				});

				const project = await Project.openProject(projFilePath);
				should(project.sqlObjectScripts.length).equal(7, `The 7 template files for an edge project should be present. Actual: ${project.sqlObjectScripts.length}`);
			});

			it('Should return silently when no SQL object name provided in prompts', async function (): Promise<void> {
				for (const name of ['', '    ', undefined]) {
					sinon.stub(vscode.window, 'showInputBox').resolves(name);
					sinon.stub(utils, 'sanitizeStringForFilename').returns('');
					const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
					const projController = new ProjectsController(testContext.outputChannel);
					const project = new Project('FakePath');

					should(project.sqlObjectScripts.length).equal(0);
					await projController.addItemPrompt(new Project('FakePath'), '', { itemType: ItemType.script });
					should(project.sqlObjectScripts.length).equal(0, 'Expected to return without throwing an exception or adding a file when an empty/undefined name is provided.');
					should(showErrorMessageSpy.notCalled).be.true('showErrorMessage should not have been called');
					sinon.restore();
				}
			});

			it('Should show error if trying to add a file that already exists', async function (): Promise<void> {
				const tableName = 'table1';
				sinon.stub(vscode.window, 'showInputBox').resolves(tableName);
				sinon.stub(utils, 'sanitizeStringForFilename').returns(tableName);
				const spy = sinon.spy(vscode.window, 'showErrorMessage');
				const projController = new ProjectsController(testContext.outputChannel);
				let project = await testUtils.createTestProject(this.test, baselines.newProjectFileBaseline);

				should(project.sqlObjectScripts.length).equal(0, 'There should be no files');
				await projController.addItemPrompt(project, '', { itemType: ItemType.script });

				should(project.sqlObjectScripts.length).equal(1, 'File should be successfully added');
				await projController.addItemPrompt(project, '', { itemType: ItemType.script });
				const msg = constants.fileAlreadyExists(tableName);
				should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once');
				should(spy.calledWith(msg)).be.true(`showErrorMessage not called with expected message '${msg}' Actual '${spy.getCall(0).args[0]}'`);
			});

			it('Should not create file if no itemTypeName is selected', async function (): Promise<void> {
				sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);
				const spy = sinon.spy(vscode.window, 'showErrorMessage');
				const projController = new ProjectsController(testContext.outputChannel);
				const project = await testUtils.createTestProject(this.test, baselines.newProjectFileBaseline);

				should(project.sqlObjectScripts.length).equal(0, 'There should be no files');
				await projController.addItemPrompt(project, '');
				should(project.sqlObjectScripts.length).equal(0, 'File should not have been added');
				should(spy.called).be.false(`showErrorMessage should not have been called called. Actual '${spy.getCall(0)?.args[0]}'`);
			});

			it('Should add existing item', async function (): Promise<void> {
				const tableName = 'table1';
				sinon.stub(vscode.window, 'showInputBox').resolves(tableName);
				sinon.stub(utils, 'sanitizeStringForFilename').returns(tableName);
				const spy = sinon.spy(vscode.window, 'showErrorMessage');
				const projController = new ProjectsController(testContext.outputChannel);
				let project = await testUtils.createTestProject(this.test, baselines.newProjectFileBaseline);

				should(project.sqlObjectScripts.length).equal(0, 'There should be no files');
				await projController.addItemPrompt(project, '', { itemType: ItemType.script });
				should(project.sqlObjectScripts.length).equal(1, 'File should be successfully added');

				// exclude item
				const projTreeRoot = new ProjectRootTreeItem(project);
				await projController.exclude(createWorkspaceTreeItem(<FileNode>projTreeRoot.children.find(x => x.friendlyName === 'table1.sql')!));

				// reload project
				project = await Project.openProject(project.projectFilePath);
				should(project.sqlObjectScripts.length).equal(0, 'File should be successfully excluded');
				should(spy.called).be.false(`showErrorMessage not called with expected message. Actual '${spy.getCall(0)?.args[0]}'`);

				// add item back
				sinon.stub(vscode.window, 'showOpenDialog').resolves([vscode.Uri.file(path.join(project.projectFolderPath, 'table1.sql'))]);
				await projController.addExistingItemPrompt(createWorkspaceTreeItem(projTreeRoot));

				// reload project
				project = await Project.openProject(project.projectFilePath);
				should(project.sqlObjectScripts.length).equal(1, 'File should be successfully re-added');
			});

			it('Should show error if trying to add a folder that already exists', async function (): Promise<void> {
				const folderName = 'folder1';
				const stub = sinon.stub(vscode.window, 'showInputBox').resolves(folderName);
				sinon.stub(utils, 'sanitizeStringForFilename').returns(folderName);

				const projController = new ProjectsController(testContext.outputChannel);
				let project = await testUtils.createTestProject(this.test, baselines.newProjectFileBaseline);
				const projectRoot = new ProjectRootTreeItem(project);

				should(project.folders.length).equal(0, 'There should be no other folders');
				await projController.addFolderPrompt(createWorkspaceTreeItem(projectRoot));

				// reload project
				project = await Project.openProject(project.projectFilePath);

				should(project.folders.length).equal(1, 'Folder should be successfully added');
				stub.restore();
				await verifyFolderNotAdded(folderName, projController, project, projectRoot);

				// reserved folder names
				for (let i in constants.reservedProjectFolders) {
					await verifyFolderNotAdded(constants.reservedProjectFolders[i], projController, project, projectRoot);
				}
			});

			it('Should be able to add folder with reserved name as long as not at project root', async function (): Promise<void> {
				const folderName = 'folder1';
				sinon.stub(vscode.window, 'showInputBox').resolves(folderName);
				sinon.stub(utils, 'sanitizeStringForFilename').returns(folderName);

				const projController = new ProjectsController(testContext.outputChannel);
				let project = await testUtils.createTestProject(this.test, baselines.openProjectFileBaseline);
				const projectRoot = new ProjectRootTreeItem(project);

				// make sure it's ok to add these folders if they aren't where the reserved folders are at the root of the project
				let node = projectRoot.children.find(c => c.friendlyName === 'Tables');
				sinon.restore();
				for (let i in constants.reservedProjectFolders) {
					// reload project
					project = await Project.openProject(project.projectFilePath);
					await verifyFolderAdded(constants.reservedProjectFolders[i], projController, project, <BaseProjectTreeItem>node);
				}
			});

			it('Should create .vscode/tasks.json with isDefault=true when configureDefaultBuild is true', async function (): Promise<void> {
				const projController = new ProjectsController(testContext.outputChannel);
				const projFileDir = await testUtils.generateTestFolderPath(this.test);

				// Act: create a new project with configureDefaultBuild: true
				const projFilePath = await projController.createNewProject({
					newProjName: 'TestProjectWithTasks',
					folderUri: vscode.Uri.file(projFileDir),
					projectTypeId: constants.emptySqlDatabaseProjectTypeId,
					configureDefaultBuild: true,
					projectGuid: 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575',
					targetPlatform: SqlTargetPlatform.sqlAzure,
					sdkStyle: false
				});

				const project = await Project.openProject(projFilePath);
				// Path to the expected tasks.json file
				const tasksJsonPath = path.join(projFileDir, project.projectFileName, '.vscode', 'tasks.json');

				// Assert: tasks.json exists
				const exists = await utils.exists(tasksJsonPath);
				should(exists).be.true('.vscode/tasks.json should be created when configureDefaultBuild is true');

				// If exists, check if isDefault is true in any build task
				if (exists) {
					const tasksJsonContent = await fs.readFile(tasksJsonPath, 'utf-8');
					const tasksJson = JSON.parse(tasksJsonContent);

					should(tasksJson.tasks).be.Array().and.have.length(1);
					const task = tasksJson.tasks[0];
					should(task.group).not.be.undefined();
					should(task.group.isDefault).equal('true', 'The build task should have isDefault: true');
				}
			});

			async function verifyFolderAdded(folderName: string, projController: ProjectsController, project: Project, node: BaseProjectTreeItem): Promise<void> {
				const beforeFolderCount = project.folders.length;
				let beforeFolders = project.folders.map(f => f.relativePath);
				sinon.stub(vscode.window, 'showInputBox').resolves(folderName);
				sinon.stub(utils, 'sanitizeStringForFilename').returns(folderName);
				await projController.addFolderPrompt(createWorkspaceTreeItem(node));

				// reload project
				project = await Project.openProject(project.projectFilePath);
				should(project.folders.length).equal(beforeFolderCount + 1, `Folder count should be increased by one after adding the folder ${folderName}. before folders: ${JSON.stringify(beforeFolders)}/n after folders: ${JSON.stringify(project.sqlObjectScripts.map(f => f.relativePath))}`);
				sinon.restore();
			}

			async function verifyFolderNotAdded(folderName: string, projController: ProjectsController, project: Project, node: BaseProjectTreeItem): Promise<void> {
				const beforeFileCount = project.folders.length;
				const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox').resolves(folderName);
				const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
				await projController.addFolderPrompt(createWorkspaceTreeItem(node));
				should(showErrorMessageSpy.calledOnce).be.true('showErrorMessage should have been called exactly once');
				const msg = constants.folderAlreadyExists(folderName);
				should(showErrorMessageSpy.calledWith(msg)).be.true(`showErrorMessage not called with expected message '${msg}' Actual '${showErrorMessageSpy.getCall(0).args[0]}'`);
				should(project.folders.length).equal(beforeFileCount, 'File count should be the same as before the folder was attempted to be added');
				showInputBoxStub.restore();
				showErrorMessageSpy.restore();
			}

			// TODO: move test to DacFx and fix delete
			it.skip('Should delete nested ProjectEntry from node', async function (): Promise<void> {
				let proj = await testUtils.createTestProject(this.test, templates.newSqlProjectTemplate);

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
				should(proj.sqlObjectScripts.length).equal(3, 'number of file entries'); // lowerEntry and the contained scripts should be deleted
				should(proj.folders[0].relativePath).equal('UpperFolder');
				should(proj.preDeployScripts.length).equal(0, 'Pre Deployment scripts should have been deleted');
				should(proj.postDeployScripts.length).equal(0, 'Post Deployment scripts should have been deleted');
				should(proj.noneDeployScripts.length).equal(0, 'None file should have been deleted');

				should(await utils.exists(scriptEntry.fsUri.fsPath)).equal(false, 'script is supposed to be deleted');
				should(await utils.exists(preDeployEntry.fsUri.fsPath)).equal(false, 'pre-deployment script is supposed to be deleted');
				should(await utils.exists(postDeployEntry.fsUri.fsPath)).equal(false, 'post-deployment script is supposed to be deleted');
				should(await utils.exists(noneEntry.fsUri.fsPath)).equal(false, 'none entry pre-deployment script is supposed to be deleted');
			});

			it('Should delete database references', async function (): Promise<void> {
				// setup - openProject baseline has a system db reference to master
				let proj = await testUtils.createTestProject(this.test, baselines.openProjectFileBaseline);
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
				// reload project
				proj = await Project.openProject(proj.projectFilePath);
				should(proj.databaseReferences.length).equal(0, 'All database references should have been deleted');
			});

			it('Should exclude nested ProjectEntry from node', async function (): Promise<void> {
				let proj = await testUtils.createTestSqlProject(this.test);
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
				should(proj.sqlObjectScripts.length).equal(0, 'number of file entries'); // LowerFolder and the contained scripts should be excluded
				should(proj.folders.find(f => f.relativePath === 'UpperFolder')).not.equal(undefined, 'UpperFolder should still be there');
				should(proj.preDeployScripts.length).equal(0, 'Pre deployment scripts');
				should(proj.postDeployScripts.length).equal(0, 'Post deployment scripts');
				should(proj.noneDeployScripts.length).equal(0, 'None files');

				should(await utils.exists(scriptEntry.fsUri.fsPath)).equal(true, 'script is supposed to still exist on disk');
				should(await utils.exists(preDeployEntry.fsUri.fsPath)).equal(true, 'pre-deployment script is supposed to still exist on disk');
				should(await utils.exists(postDeployEntry.fsUri.fsPath)).equal(true, 'post-deployment script is supposed to still exist on disk');
				should(await utils.exists(noneEntry.fsUri.fsPath)).equal(true, 'none entry pre-deployment script is supposed to still exist on disk');
			});

			it('Should exclude a folder', async function (): Promise<void> {
				let proj = await testUtils.createTestSqlProject(this.test);
				await proj.addScriptItem('SomeFolder/MyTable.sql', 'CREATE TABLE [NotARealTable]');

				const projController = new ProjectsController(testContext.outputChannel);
				const projTreeRoot = new ProjectRootTreeItem(proj);

				should(await utils.exists(path.join(proj.projectFolderPath, 'SomeFolder/MyTable.sql'))).be.true('File should exist in original location');
				(proj.sqlObjectScripts.length).should.equal(1, 'Starting number of scripts');
				(proj.folders.length).should.equal(1, 'Starting number of folders');

				// exclude folder
				const folderNode = projTreeRoot.children.find(f => f.friendlyName === 'SomeFolder');
				await projController.exclude(createWorkspaceTreeItem(folderNode!));

				// reload project and verify files were renamed
				proj = await Project.openProject(proj.projectFilePath);

				should(await utils.exists(path.join(proj.projectFolderPath, 'SomeFolder', 'MyTable.sql'))).be.true('File should still exist on disk');
				(proj.sqlObjectScripts.length).should.equal(0, 'Number of scripts should not have changed');
				(proj.folders.length).should.equal(0, 'Number of folders should not have changed');
			});

			// TODO: move test to DacFx and fix delete
			it.skip('Should delete folders with excluded items', async function (): Promise<void> {
				let proj = await testUtils.createTestProject(this.test, templates.newSqlProjectTemplate);
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
				should(proj.sqlObjectScripts.some(x => x.relativePath === 'UpperFolder')).equal(false, 'UpperFolder should not be part of proj file any more');
				should(await utils.exists(scriptEntry.fsUri.fsPath)).equal(false, 'script is supposed to be deleted from disk');
				should(await utils.exists(lowerFolder.relativeProjectUri.fsPath)).equal(false, 'LowerFolder is supposed to be deleted from disk');
				should(await utils.exists(upperFolder.relativeProjectUri.fsPath)).equal(false, 'UpperFolder is supposed to be deleted from disk');
			});

			it('Should reload correctly after changing sqlproj file', async function (): Promise<void> {
				// create project
				const folderPath = await testUtils.generateTestFolderPath(this.test);
				const sqlProjPath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline, folderPath);
				const treeProvider = new SqlDatabaseProjectTreeViewProvider();
				const projController = new ProjectsController(testContext.outputChannel);
				let project = await Project.openProject(vscode.Uri.file(sqlProjPath).fsPath);
				treeProvider.load([project]);

				// change the sql project file
				await fs.writeFile(sqlProjPath, baselines.newProjectFileWithScriptBaseline);
				should(project.sqlObjectScripts.length).equal(0);

				// call reload project
				const projTreeRoot = new ProjectRootTreeItem(project);
				await projController.reloadProject(createWorkspaceTreeItem(projTreeRoot));
				// calling this because this gets called in the projectProvider.getProjectTreeDataProvider(), which is called by workspaceTreeDataProvider
				// when notifyTreeDataChanged() happens
				// reload project
				project = await Project.openProject(sqlProjPath, false, true);
				treeProvider.load([project]);

				// check that the new project is in the tree
				should(project.sqlObjectScripts.length).equal(1);
				should(treeProvider.getChildren()[0].children.find(c => c.friendlyName === 'Script1.sql')).not.equal(undefined);
			});

			it('Should be able to add pre deploy and post deploy script', async function (): Promise<void> {
				const preDeployScriptName = 'PreDeployScript1.sql';
				const postDeployScriptName = 'PostDeployScript1.sql';

				const projController = new ProjectsController(testContext.outputChannel);
				const project = await testUtils.createTestProject(this.test, baselines.newProjectFileBaseline);

				sinon.stub(vscode.window, 'showInputBox').resolves(preDeployScriptName);
				sinon.stub(utils, 'sanitizeStringForFilename').returns(preDeployScriptName);
				should(project.preDeployScripts.length).equal(0, 'There should be no pre deploy scripts');
				await projController.addItemPrompt(project, '', { itemType: ItemType.preDeployScript });
				should(project.preDeployScripts.length).equal(1, `Pre deploy script should be successfully added. ${project.preDeployScripts.length}, ${project.sqlObjectScripts.length}`);

				sinon.restore();
				sinon.stub(vscode.window, 'showInputBox').resolves(postDeployScriptName);
				sinon.stub(utils, 'sanitizeStringForFilename').returns(postDeployScriptName);
				should(project.postDeployScripts.length).equal(0, 'There should be no post deploy scripts');
				await projController.addItemPrompt(project, '', { itemType: ItemType.postDeployScript });
				should(project.postDeployScripts.length).equal(1, 'Post deploy script should be successfully added');
			});

			it('Should be able to add publish profile', async function (): Promise<void> {
				const publishProfileName = 'profile.publish.xml';

				const projController = new ProjectsController(testContext.outputChannel);
				const project = await testUtils.createTestProject(this.test, baselines.newProjectFileBaseline);

				sinon.stub(vscode.window, 'showInputBox').resolves(publishProfileName);
				sinon.stub(utils, 'sanitizeStringForFilename').returns(publishProfileName);
				should(project.publishProfiles.length).equal(0, 'There should be no publish profiles');
				await projController.addItemPrompt(project, '', { itemType: ItemType.publishProfile });
				should(project.publishProfiles.length).equal(1, 'Publish profile should be successfully added.');
			});

			it('Should change target platform', async function (): Promise<void> {
				sinon.stub(vscode.window, 'showQuickPick').resolves({ label: SqlTargetPlatform.sqlAzure });

				const projController = new ProjectsController(testContext.outputChannel);
				const sqlProjPath = await testUtils.createTestSqlProjFile(this.test, baselines.openProjectFileBaseline);
				const project = await Project.openProject(sqlProjPath);
				should(project.getProjectTargetVersion()).equal(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2019));
				should(project.databaseReferences.length).equal(1, 'Project should have one database reference to master');

				await projController.changeTargetPlatform(project);
				should(project.getProjectTargetVersion()).equal(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure));
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
				const proj = new Project('FakePath');
				sinon.stub(proj, 'getProjectTargetVersion').returns('150');
				await projController.object.publishProject(proj);
				should(opened).equal(true);
			});

			it('Callbacks are hooked up and called from Publish dialog', async function (): Promise<void> {
				const projectFile = await testUtils.createTestSqlProjFile(this.test, baselines.openProjectFileBaseline)
				const projFolder = path.dirname(projectFile);
				await testUtils.createTestDataSources(this.test, baselines.openDataSourcesBaseline, projFolder);
				const proj = await Project.openProject(projectFile);

				const publishHoller = 'hello from callback for publish()';
				const generateHoller = 'hello from callback for generateScript()';

				let holler = 'nothing';

				const setupPublishDialog = (): PublishDatabaseDialog => {
					const dialog = new PublishDatabaseDialog(proj);
					sinon.stub(dialog, 'getConnectionUri').returns(Promise.resolve('fake|connection|uri'));
					return dialog;
				};

				let publishDialog = setupPublishDialog();

				let projController = TypeMoq.Mock.ofType(ProjectsController);
				projController.callBase = true;
				projController.setup(x => x.getPublishDialog(TypeMoq.It.isAny())).returns(() => {
					return publishDialog;
				});
				projController.setup(x => x.publishOrScriptProject(TypeMoq.It.isAny(), TypeMoq.It.isAny(), true)).returns(() => {
					holler = publishHoller;
					return Promise.resolve(undefined);
				});

				projController.setup(x => x.publishOrScriptProject(TypeMoq.It.isAny(), TypeMoq.It.isAny(), false)).returns(() => {
					holler = generateHoller;
					return Promise.resolve(undefined);
				});
				publishDialog.publishToExistingServer = true;
				void projController.object.publishProject(proj);
				await publishDialog.publishClick();

				should(holler).equal(publishHoller, 'executionCallback() is supposed to have been setup and called for Publish scenario');

				publishDialog = setupPublishDialog();
				void projController.object.publishProject(proj);
				await publishDialog.generateScriptClick();

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
					builtDacpacPath = await testUtils.createTestFile(this.test, fakeDacpacContents, 'output.dacpac');
					return builtDacpacPath;
				});
				sinon.stub(utils, 'getDacFxService').resolves(testContext.dacFxService.object);

				const proj = await testUtils.createTestProject(this.test, baselines.openProjectFileBaseline);

				await projController.object.publishOrScriptProject(proj, { connectionUri: '', databaseName: '', serverName: '' }, false);

				should(builtDacpacPath).not.equal('', 'built dacpac path should be set');
				should(publishedDacpacPath).not.equal('', 'published dacpac path should be set');
				should(builtDacpacPath).not.equal(publishedDacpacPath, 'built and published dacpac paths should be different');
				should(postCopyContents).equal(fakeDacpacContents, 'contents of built and published dacpacs should match');
				await fs.rm(publishedDacpacPath);
			});
		});
	});

	describe('Create project from database operations and dialog', function (): void {
		afterEach(() => {
			sinon.restore();
		});

		it('Should create list of all files and folders correctly', async function (): Promise<void> {
			// dummy structure is 2 files (one .sql, one .txt) under parent folder + 2 directories with 5 .sql scripts each
			const testFolderPath = await testUtils.createDummyFileStructure(this.test);

			const projController = new ProjectsController(testContext.outputChannel);
			const fileList = await projController.generateScriptList(testFolderPath);

			// script list should only include the .sql files, no folders and not the .txt file
			(fileList.length).should.equal(11, 'number of files returned by generateScriptList()');
			(fileList.filter(x => path.extname(x.fsPath) !== constants.sqlFileExtension).length).should.equal(0, 'number of non-.sql files');
		});

		it('Should error out for inaccessible path', async function (): Promise<void> {
			const spy = sinon.spy(vscode.window, 'showErrorMessage');

			let testFolderPath = await testUtils.generateTestFolderPath(this.test);
			testFolderPath += '_nonexistentFolder';	// Modify folder path to point to a nonexistent location

			const projController = new ProjectsController(testContext.outputChannel);

			await projController.generateScriptList(testFolderPath);
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
					extractTarget: mssql.ExtractTarget['schemaObjectType'],
					sdkStyle: false
				}, undefined);

				return Promise.resolve(undefined);
			});

			const projController = TypeMoq.Mock.ofType(ProjectsController);
			projController.callBase = true;
			projController.setup(x => x.getCreateProjectFromDatabaseDialog(TypeMoq.It.isAny())).returns(() => createProjectFromDatabaseDialog.object);
			projController.setup(x => x.createProjectFromDatabaseCallback(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
				holler = createProjectFromDbHoller;
				return Promise.resolve(undefined);
			});

			let dialog = await projController.object.createProjectFromDatabase(undefined);
			await dialog!.handleCreateButtonClick();

			should(holler).equal(createProjectFromDbHoller, 'executionCallback() is supposed to have been setup and called for create project from database scenario');
		});

		it('Should set model filePath correctly for ExtractType = File', async function (): Promise<void> {
			let folderPath = await testUtils.generateTestFolderPath(this.test);
			let projectName = 'My Project';
			let importPath;
			let model: ImportDataModel = { connectionUri: 'My Id', database: 'My Database', projName: projectName, filePath: folderPath, version: '1.0.0.0', extractTarget: mssql.ExtractTarget['file'], sdkStyle: false };

			const projController = new ProjectsController(testContext.outputChannel);
			projController.setFilePath(model);
			importPath = model.filePath;

			should(importPath.toUpperCase()).equal(vscode.Uri.file(path.join(folderPath, projectName + '.sql')).fsPath.toUpperCase(), `model.filePath should be set to a specific file for ExtractTarget === file, but was ${importPath}`);
		});

		it('Should set model filePath correctly for ExtractType = Schema/Object Type', async function (): Promise<void> {
			let folderPath = await testUtils.generateTestFolderPath(this.test);
			let projectName = 'My Project';
			let importPath;
			let model: ImportDataModel = { connectionUri: 'My Id', database: 'My Database', projName: projectName, filePath: folderPath, version: '1.0.0.0', extractTarget: mssql.ExtractTarget['schemaObjectType'], sdkStyle: false };

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
			const projPath = path.dirname(await testUtils.createTestSqlProjFile(this.test, baselines.openProjectFileBaseline));
			const proj = new Project(projPath);

			const addDbRefHoller = 'hello from callback for addDatabaseReference()';

			let holler = 'nothing';

			const addDbReferenceDialog = TypeMoq.Mock.ofType(AddDatabaseReferenceDialog, undefined, undefined, proj);
			addDbReferenceDialog.callBase = true;
			addDbReferenceDialog.setup(x => x.addReferenceClick()).returns(() => {
				return projController.object.addDatabaseReferenceCallback(proj,
					{ systemDb: SystemDatabase.Master, databaseName: 'master', suppressMissingDependenciesErrors: false, systemDbReferenceType: mssql.SystemDbReferenceType.ArtifactReference },
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

		it.skip('Should not allow adding circular project references', async function (): Promise<void> {
			const projPath1 = await testUtils.createTestSqlProjFile(this.test, baselines.openProjectFileBaseline);
			const projPath2 = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
			const projController = new ProjectsController(testContext.outputChannel);

			const project1 = await Project.openProject(vscode.Uri.file(projPath1).fsPath);
			const project2 = await Project.openProject(vscode.Uri.file(projPath2).fsPath);
			const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
			const dataWorkspaceMock = TypeMoq.Mock.ofType<dataworkspace.IExtension>();
			dataWorkspaceMock.setup(x => x.getProjectsInWorkspace(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve([vscode.Uri.file(project1.projectFilePath), vscode.Uri.file(project2.projectFilePath)]));
			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: dataWorkspaceMock.object });
			sinon.stub(utils, 'getDacFxService').returns(<any>{
				parseTSqlScript: (_: string, __: string) => {
					return Promise.resolve({ containsCreateTableStatement: true });
				}
			});

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

		it.skip('Should add dacpac references as relative paths', async function (): Promise<void> {
			const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
			const projController = new ProjectsController(testContext.outputChannel);

			const project1 = await Project.openProject(vscode.Uri.file(projFilePath).fsPath);
			const showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
			const dataWorkspaceMock = TypeMoq.Mock.ofType<dataworkspace.IExtension>();
			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: dataWorkspaceMock.object });
			sinon.stub(utils, 'getDacFxService').returns(<any>{
				parseTSqlScript: (_: string, __: string) => {
					return Promise.resolve({ containsCreateTableStatement: true });
				}
			});
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
			should(project1.databaseReferences[0].referenceName).equal('sameFolderTest');
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
			should(project1.databaseReferences[1].referenceName).equal('nestedFolderTest');
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
			should(project1.databaseReferences[2].referenceName).equal('outsideFolderTest');
			should(project1.databaseReferences[2].pathForSqlProj()).equal('..\\someFolder\\outsideFolderTest.dacpac');
			// make sure reference to outsideFolderTest.dacpac was added to project file
			projFileText = (await fs.readFile(projFilePath)).toString();
			should(projFileText).containEql('..\\someFolder\\outsideFolderTest.dacpac');
		});
	});

	describe('AutoRest generation', function (): void {
		// skipping for now because this feature is hidden under preview flag
		it.skip('Should create project from autorest-generated files', async function (): Promise<void> {
			const parentFolder = await testUtils.generateTestFolderPath(this.test);
			await testUtils.createDummyFileStructure(this.test);
			const specName = 'DummySpec.yaml';
			const renamedProjectName = 'RenamedProject';
			const newProjFolder = path.join(parentFolder, renamedProjectName);
			let fileList: vscode.Uri[] = [];

			const projController = TypeMoq.Mock.ofType(ProjectsController);
			projController.callBase = true;

			projController.setup(x => x.selectAutorestSpecFile()).returns(async () => specName);
			projController.setup(x => x.selectAutorestProjectLocation(TypeMoq.It.isAny(), undefined)).returns(async () => {
				await fs.mkdir(newProjFolder);

				return {
					newProjectFolder: newProjFolder,
					outputFolder: parentFolder,
					projectName: renamedProjectName
				};
			});

			projController.setup(x => x.generateAutorestFiles(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => {
				await testUtils.createDummyFileStructure(this.test, true, fileList, newProjFolder);
				await testUtils.createTestFile(this.test, 'SELECT \'This is a post-deployment script\'', constants.autorestPostDeploymentScriptName, newProjFolder);
				return 'some dummy console output';
			});

			projController.setup(x => x.promptForAutorestProjectName(TypeMoq.It.isAny())).returns(async () => renamedProjectName);
			projController.setup(x => x.openProjectInWorkspace(TypeMoq.It.isAny())).returns(async () => { });

			const project = (await projController.object.generateProjectFromOpenApiSpec())!;

			should(project.projectFileName).equal(renamedProjectName);
			should(project.projectFolderPath.endsWith(renamedProjectName)).is.true(`Expected: '${project.projectFolderPath}' to include '${renamedProjectName}'`);

			should(project.postDeployScripts.length).equal(1, `Expected 1 post-deployment script, got ${project?.postDeployScripts.length}`);
			const actual = path.basename(project.postDeployScripts[0].fsUri.fsPath);
			should(actual).equal(constants.autorestPostDeploymentScriptName, `Unexpected post-deployment script name: ${actual}, expected ${constants.autorestPostDeploymentScriptName}`);

			const expectedScripts = fileList.filter(f => path.extname(f.fsPath) === '.sql');
			should(project.sqlObjectScripts.filter(f => f.type === EntryType.File).length).equal(expectedScripts.length, 'Unexpected number of scripts in project');

			const expectedFolders = fileList.filter(f => path.extname(f.fsPath) === '' && f.fsPath.toUpperCase() !== newProjFolder.toUpperCase());
			should(project.sqlObjectScripts.filter(f => f.type === EntryType.Folder).length).equal(expectedFolders.length, 'Unexpected number of folders in project');
		});
	});

	describe('Move file', function (): void {
		it('Should move a file to another folder', async function (): Promise<void> {
			const spy = sinon.spy(vscode.window, 'showErrorMessage');
			sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.move));

			let proj = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);

			const projTreeRoot = await setupMoveTest(proj);

			const projController = new ProjectsController(testContext.outputChannel);

			// try to move a file from the root folder into the UpperFolder
			const sqlFileNode = projTreeRoot.children.find(x => x.friendlyName === 'script1.sql');
			const folderWorkspaceTreeItem = createWorkspaceTreeItem(projTreeRoot.children.find(x => x.friendlyName === 'UpperFolder')!);
			await projController.moveFile(vscode.Uri.file(proj.projectFilePath), sqlFileNode, folderWorkspaceTreeItem);

			should(spy.notCalled).be.true('showErrorMessage should not have been called');

			// reload project and verify file was moved
			proj = await Project.openProject(proj.projectFilePath);
			should(proj.sqlObjectScripts.find(f => f.relativePath === 'UpperFolder\\script1.sql') !== undefined).be.true('The file path should have been updated');
			should(await utils.exists(path.join(proj.projectFolderPath, 'UpperFolder', 'script1.sql'))).be.true('The moved file should exist');
		});

		it('Should move a folder to another folder', async function (): Promise<void> {
			const spy = sinon.spy(vscode.window, 'showErrorMessage');
			sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.move));

			let proj = await testUtils.createTestProject(this.test, baselines.newSdkStyleProjectSdkNodeBaseline);

			const projTreeRoot = await setupMoveTest(proj);

			const projController = new ProjectsController(testContext.outputChannel);

			// try to move a child folder to go under the root folder
			const folderNode = projTreeRoot.children.find(x => x.friendlyName === 'folder1');
			const folderWorkspaceTreeItem = createWorkspaceTreeItem(projTreeRoot.children.find(x => x.friendlyName === 'UpperFolder')!);
			await projController.moveFile(vscode.Uri.file(proj.projectFilePath), folderNode, folderWorkspaceTreeItem);

			should(spy.notCalled).be.true('showErrorMessage should not have been called');

			// reload project and verify file was moved
			proj = await Project.openProject(proj.projectFilePath);
			should(proj.folders.find(f => f.relativePath === 'UpperFolder\\folder1') !== undefined).be.true('The folder path should have been updated');
		});

		it('Should not allow moving a file to Database References or SQLCMD folder', async function (): Promise<void> {
			const spy = sinon.spy(vscode.window, 'showErrorMessage');
			sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.move));

			let proj = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);
			const projTreeRoot = await setupMoveTest(proj);
			const projController = new ProjectsController(testContext.outputChannel);

			const foldersToTest = ['SQLCMD Variables', 'Database References'];

			for (const folder of foldersToTest) {
				// try to move a file from the root folder into the UpperFolder
				const sqlFileNode = projTreeRoot.children.find(x => x.friendlyName === 'script1.sql');
				const sqlCmdVariablesWorkspaceTreeItem = createWorkspaceTreeItem(projTreeRoot.children.find(x => x.friendlyName === folder)!);
				await projController.moveFile(vscode.Uri.file(proj.projectFilePath), sqlFileNode, sqlCmdVariablesWorkspaceTreeItem);

				// reload project and verify file was not moved
				proj = await Project.openProject(proj.projectFilePath);
				should(proj.sqlObjectScripts.find(f => f.relativePath === 'script1.sql') !== undefined).be.true(`The file path should not have been updated when trying to move script1.sql to ${folder}`);
				should(spy.notCalled).be.true('showErrorMessage should not have been called.');
				spy.restore();
			}
		});

		it('Should only allow moving files and folders', async function (): Promise<void> {
			const spy = sinon.spy(vscode.window, 'showErrorMessage');
			let proj = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);
			const projTreeRoot = await setupMoveTest(proj);
			const projController = new ProjectsController(testContext.outputChannel);

			// try to move sqlcmd variable
			const sqlcmdVarNode = projTreeRoot.children.find(x => x.friendlyName === 'SQLCMD Variables')!.children[0];
			const projectRootWorkspaceTreeItem = createWorkspaceTreeItem(projTreeRoot);
			await projController.moveFile(vscode.Uri.file(proj.projectFilePath), sqlcmdVarNode, projectRootWorkspaceTreeItem);

			should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once when trying to move a sqlcmd variable');
			should(spy.calledWith(constants.onlyMoveFilesFoldersSupported)).be.true(`showErrorMessage not called with expected message '${constants.onlyMoveFilesFoldersSupported}' Actual '${spy.getCall(0).args[0]}'`);
			spy.restore();

			// try moving a database reference
			const dbRefNode = projTreeRoot.children.find(x => x.friendlyName === 'Database References')!.children[0];
			await projController.moveFile(vscode.Uri.file(proj.projectFilePath), dbRefNode, projectRootWorkspaceTreeItem);

			should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once when trying to move a database reference');
			should(spy.calledWith(constants.onlyMoveFilesFoldersSupported)).be.true(`showErrorMessage not called with expected message '${constants.onlyMoveFilesFoldersSupported}' Actual '${spy.getCall(0).args[0]}'`);
			spy.restore();
		});

		it('Should not allow moving files between projects', async function (): Promise<void> {
			const spy = sinon.spy(vscode.window, 'showErrorMessage');
			sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.move));

			let proj1 = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);
			let proj2 = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);

			const projTreeRoot1 = await setupMoveTest(proj1);
			const projTreeRoot2 = await setupMoveTest(proj2);
			const projController = new ProjectsController(testContext.outputChannel);

			// try to move a file from the root folder of proj1 to the UpperFolder of proj2
			const proj1SqlFileNode = projTreeRoot1.children.find(x => x.friendlyName === 'script1.sql');
			const proj2FolderWorkspaceTreeItem = createWorkspaceTreeItem(projTreeRoot2.children.find(x => x.friendlyName === 'UpperFolder')!);
			await projController.moveFile(vscode.Uri.file(proj1.projectFilePath), proj1SqlFileNode, proj2FolderWorkspaceTreeItem);

			should(spy.called).be.true('showErrorMessage should have been called');
			should(spy.calledWith(constants.movingFilesBetweenProjectsNotSupported)).be.true(`showErrorMessage not called with expected message '${constants.movingFilesBetweenProjectsNotSupported}' Actual '${spy.getCall(0).args[0]}'`);

			// verify script1.sql was not moved
			proj1 = await Project.openProject(proj1.projectFilePath);
			should(proj1.sqlObjectScripts.find(f => f.relativePath === 'script1.sql') !== undefined).be.true(`The file path should not have been updated when trying to move script1.sql to proj2`);
		});
	});

	describe('Rename file', function (): void {
		it('Should not do anything if no new name is provided', async function (): Promise<void> {
			sinon.stub(vscode.window, 'showInputBox').resolves('');
			let proj = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);
			const projTreeRoot = await setupMoveTest(proj);
			const projController = new ProjectsController(testContext.outputChannel);

			// try to rename a file from the root folder
			const sqlFileNode = projTreeRoot.children.find(x => x.friendlyName === 'script1.sql');
			await projController.rename(createWorkspaceTreeItem(sqlFileNode!));

			// reload project and verify file was not renamed
			proj = await Project.openProject(proj.projectFilePath);
			should(proj.sqlObjectScripts.find(f => f.relativePath === 'script1.sql') !== undefined).be.true('The file path should not have been updated');
			should(await utils.exists(path.join(proj.projectFolderPath, 'script1.sql'))).be.true('The moved file should exist');
		});

		it('Should rename a sql object file', async function (): Promise<void> {
			sinon.stub(vscode.window, 'showInputBox').resolves('newName.sql');
			let proj = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);
			const projTreeRoot = await setupMoveTest(proj);
			const projController = new ProjectsController(testContext.outputChannel);

			// try to rename a file from the root folder
			const sqlFileNode = projTreeRoot.children.find(x => x.friendlyName === 'script1.sql');
			await projController.rename(createWorkspaceTreeItem(sqlFileNode!));

			// reload project and verify file was renamed
			proj = await Project.openProject(proj.projectFilePath);
			should(proj.sqlObjectScripts.find(f => f.relativePath === 'newName.sql') !== undefined).be.true('The file path should have been updated');
			should(await utils.exists(path.join(proj.projectFolderPath, 'newName.sql'))).be.true('The moved file should exist');
		});

		it('Should rename a pre and post deploy script', async function (): Promise<void> {
			let proj = await testUtils.createTestProject(this.test, baselines.newSdkStyleProjectSdkNodeBaseline);
			await proj.addScriptItem('Script.PreDeployment1.sql', 'pre-deployment stuff', ItemType.preDeployScript);
			await proj.addScriptItem('Script.PostDeployment1.sql', 'post-deployment stuff', ItemType.postDeployScript);

			const projController = new ProjectsController(testContext.outputChannel);
			const projTreeRoot = new ProjectRootTreeItem(proj);

			// try to rename a file from the root folder
			sinon.stub(vscode.window, 'showInputBox').resolves('predeployNewName.sql');
			const preDeployScriptNode = projTreeRoot.children.find(x => x.friendlyName === 'Script.PreDeployment1.sql');
			await projController.rename(createWorkspaceTreeItem(preDeployScriptNode!));

			sinon.restore();
			sinon.stub(vscode.window, 'showInputBox').resolves('postdeployNewName.sql');
			const postDeployScriptNode = projTreeRoot.children.find(x => x.friendlyName === 'Script.PostDeployment1.sql');
			await projController.rename(createWorkspaceTreeItem(postDeployScriptNode!));

			// reload project and verify files were renamed
			proj = await Project.openProject(proj.projectFilePath);
			should(proj.preDeployScripts.find(f => f.relativePath === 'predeployNewName.sql') !== undefined).be.true('The pre deploy script file path should have been updated');
			should(await utils.exists(path.join(proj.projectFolderPath, 'predeployNewName.sql'))).be.true('The moved pre deploy script file should exist');

			should(proj.postDeployScripts.find(f => f.relativePath === 'postdeployNewName.sql') !== undefined).be.true('The post deploy script file path should have been updated');
			should(await utils.exists(path.join(proj.projectFolderPath, 'postdeployNewName.sql'))).be.true('The moved post deploy script file should exist');
		});

		it('Should rename a folder', async function (): Promise<void> {
			let proj = await testUtils.createTestSqlProject(this.test);
			await proj.addScriptItem('SomeFolder/MyTable.sql', 'CREATE TABLE [NotARealTable]');

			const projController = new ProjectsController(testContext.outputChannel);
			const projTreeRoot = new ProjectRootTreeItem(proj);

			sinon.stub(vscode.window, 'showInputBox').resolves('RenamedFolder');
			should(await utils.exists(path.join(proj.projectFolderPath, 'SomeFolder', 'MyTable.sql'))).be.true('File should exist in original location');
			(proj.sqlObjectScripts.length).should.equal(1, 'Starting number of scripts');
			(proj.folders.length).should.equal(1, 'Starting number of folders');

			// rename folder
			const folderNode = projTreeRoot.children.find(f => f.friendlyName === 'SomeFolder');
			await projController.rename(createWorkspaceTreeItem(folderNode!));

			// reload project and verify files were renamed
			proj = await Project.openProject(proj.projectFilePath);

			should(await utils.exists(path.join(proj.projectFolderPath, 'RenamedFolder', 'MyTable.sql'))).be.true('File should exist in new location');
			(proj.sqlObjectScripts.length).should.equal(1, 'Number of scripts should not have changed');
			(proj.folders.length).should.equal(1, 'Number of folders should not have changed');
			should(proj.folders.find(f => f.relativePath === 'RenamedFolder') !== undefined).be.true('The folder path should have been updated');
			should(proj.sqlObjectScripts.find(f => f.relativePath === 'RenamedFolder\\MyTable.sql') !== undefined).be.true('Path of the script in the folder should have been updated');
		});
	});

	describe('SqlCmd Variables', function (): void {
		it('Should delete sqlcmd variable', async function (): Promise<void> {
			let project = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);
			const sqlProjectsService = await utils.getSqlProjectsService();
			await sqlProjectsService.openProject(project.projectFilePath);

			const projController = new ProjectsController(testContext.outputChannel);
			const projRoot = new ProjectRootTreeItem(project);

			should(project.sqlCmdVariables.size).equal(2, 'The project should start with 2 sqlcmd variables');

			sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve('Cancel'));
			await projController.delete(createWorkspaceTreeItem(projRoot.children.find(x => x.friendlyName === constants.sqlcmdVariablesNodeName)!.children[0] /* LowerFolder */));

			// reload project
			project = await Project.openProject(project.projectFilePath);
			should(project.sqlCmdVariables.size).equal(2, 'The project should still have 2 sqlcmd variables if no was selected');

			sinon.restore();
			sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve('Yes'));
			await projController.delete(createWorkspaceTreeItem(projRoot.children.find(x => x.friendlyName === constants.sqlcmdVariablesNodeName)!.children[0]));

			// reload project
			project = await Project.openProject(project.projectFilePath);
			should(project.sqlCmdVariables.size).equal(1, 'The project should only have 1 sqlcmd variable after deletion');
		});

		it('Should add sqlcmd variable', async function (): Promise<void> {
			let project = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);
			const sqlProjectsService = await utils.getSqlProjectsService();
			await sqlProjectsService.openProject(project.projectFilePath);

			const projController = new ProjectsController(testContext.outputChannel);
			const projRoot = new ProjectRootTreeItem(project);

			should(project.sqlCmdVariables.size).equal(2, 'The project should start with 2 sqlcmd variables');

			const inputBoxStub = sinon.stub(vscode.window, 'showInputBox');
			inputBoxStub.resolves('');
			await projController.addSqlCmdVariable(createWorkspaceTreeItem(projRoot.children.find(x => x.friendlyName === constants.sqlcmdVariablesNodeName)!));

			// reload project
			project = await Project.openProject(project.projectFilePath);
			should(project.sqlCmdVariables.size).equal(2, 'The project should still have 2 sqlcmd variables if no name was provided');

			inputBoxStub.reset();
			inputBoxStub.onFirstCall().resolves('newVariable');
			inputBoxStub.onSecondCall().resolves('testValue');
			await projController.addSqlCmdVariable(createWorkspaceTreeItem(projRoot.children.find(x => x.friendlyName === constants.sqlcmdVariablesNodeName)!));

			// reload project
			project = await Project.openProject(project.projectFilePath);
			should(project.sqlCmdVariables.size).equal(3, 'The project should have 3 sqlcmd variable after adding a new one');
		});

		it('Should add sqlcmd variable without DefaultValue', async function (): Promise<void> {
			let project = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);
			const sqlProjectsService = await utils.getSqlProjectsService();
			await sqlProjectsService.openProject(project.projectFilePath);

			const projController = new ProjectsController(testContext.outputChannel);
			const projRoot = new ProjectRootTreeItem(project);

			should(project.sqlCmdVariables.size).equal(2, 'The project should start with 2 sqlcmd variables');

			const inputBoxStub = sinon.stub(vscode.window, 'showInputBox');
			inputBoxStub.onFirstCall().resolves('newVariable');
			inputBoxStub.onSecondCall().resolves(undefined);
			const infoMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
			infoMessageStub.onFirstCall().returns(<any>Promise.resolve(constants.noString));
			await projController.addSqlCmdVariable(createWorkspaceTreeItem(projRoot.children.find(x => x.friendlyName === constants.sqlcmdVariablesNodeName)!));

			// reload project
			project = await Project.openProject(project.projectFilePath);
			should(project.sqlCmdVariables.size).equal(2, 'The project should still have 2 sqlcmd variables if no was selected for adding sqlcmd variable without a DefaultValue');

			inputBoxStub.reset();
			inputBoxStub.onFirstCall().resolves('newVariable');
			inputBoxStub.onSecondCall().resolves(undefined);
			infoMessageStub.onSecondCall().returns(<any>Promise.resolve(constants.yesString));
			await projController.addSqlCmdVariable(createWorkspaceTreeItem(projRoot.children.find(x => x.friendlyName === constants.sqlcmdVariablesNodeName)!));

			// reload project
			project = await Project.openProject(project.projectFilePath);
			should(project.sqlCmdVariables.size).equal(3, 'The project should have 3 sqlcmd variable after adding a new one without a DefaultValue');
			should(project.sqlCmdVariables.get('newVariable')).equal('', 'The default value of newVariable should be an empty string');
		});


		it('Should update sqlcmd variable', async function (): Promise<void> {
			let project = await testUtils.createTestProject(this.test, baselines.openSdkStyleSqlProjectBaseline);
			const sqlProjectsService = await utils.getSqlProjectsService();
			await sqlProjectsService.openProject(project.projectFilePath);

			const projController = new ProjectsController(testContext.outputChannel);
			const projRoot = new ProjectRootTreeItem(project);

			should(project.sqlCmdVariables.size).equal(2, 'The project should start with 2 sqlcmd variables');

			const inputBoxStub = sinon.stub(vscode.window, 'showInputBox');
			inputBoxStub.resolves('');
			const sqlcmdVarToUpdate = projRoot.children.find(x => x.friendlyName === constants.sqlcmdVariablesNodeName)!.children[0];
			const originalValue = project.sqlCmdVariables.get(sqlcmdVarToUpdate.friendlyName);
			await projController.editSqlCmdVariable(createWorkspaceTreeItem(sqlcmdVarToUpdate));

			// reload project
			project = await Project.openProject(project.projectFilePath);
			should(project.sqlCmdVariables.size).equal(2, 'The project should still have 2 sqlcmd variables');
			should(project.sqlCmdVariables.get(sqlcmdVarToUpdate.friendlyName)).equal(originalValue, 'The value of the sqlcmd variable should not have changed');

			inputBoxStub.reset();
			const updatedValue = 'newValue';
			inputBoxStub.resolves(updatedValue);
			await projController.editSqlCmdVariable(createWorkspaceTreeItem(sqlcmdVarToUpdate));

			// reload project
			project = await Project.openProject(project.projectFilePath);
			should(project.sqlCmdVariables.size).equal(2, 'The project should still have 2 sqlcmd variables');
			should(project.sqlCmdVariables.get(sqlcmdVarToUpdate.friendlyName)).equal(updatedValue, 'The value of the sqlcmd variable should have been updated');
		});

		it('Should remove file extensions from user input when creating files', async function (): Promise<void> {
			const projController = new ProjectsController(testContext.outputChannel);
			let project = await testUtils.createTestProject(this.test, baselines.newProjectFileBaseline);

			// Test cases for different extension scenarios
			const testCases = [
				{ input: 'TableName.sql', expected: 'TableName', extension: constants.sqlFileExtension },
				{ input: 'TableName.sql.sql', expected: 'TableName.sql', extension: constants.sqlFileExtension },
				{ input: 'MyTable', expected: 'MyTable', extension: constants.sqlFileExtension }, // no extension
				{ input: 'MyTable.SQL', expected: 'MyTable', extension: constants.sqlFileExtension }, // uppercase extension
				{ input: 'MyTable .Sql', expected: 'MyTable', extension: constants.sqlFileExtension }, // mixed case extension
				{ input: 'PubProfile.publish.xml', expected: 'PubProfile', extension: constants.publishProfileExtension },
				{ input: 'PubProfile.publish.xml.publish.xml', expected: 'PubProfile.publish.xml', extension: constants.publishProfileExtension }
			];

			for (const testCase of testCases) {
				// Mock the user input
				sinon.stub(vscode.window, 'showInputBox').resolves(testCase.input);
				sinon.stub(utils, 'sanitizeStringForFilename').returns(testCase.input);

				// Add item to project
				if (testCase.extension === constants.sqlFileExtension) {
					await projController.addItemPrompt(project, '', { itemType: ItemType.script });
				} else {
					await projController.addItemPrompt(project, '', { itemType: ItemType.publishProfile });
				}

				// Reload project to get updated state
				project = await Project.openProject(project.projectFilePath);

				// Find the created file
				const expectedFileName = `${testCase.expected}${testCase.extension}`;

				// Find the file project entry
				let fileProjectEntry = project.sqlObjectScripts;
				if (testCase.extension === constants.publishProfileExtension) {
					fileProjectEntry = project.publishProfiles;
				}

				// Get the created file
				const createdFile = fileProjectEntry.find(f => path.basename(f.relativePath) === expectedFileName);

				// Assert the created file exists
				should(createdFile).not.be.undefined();
				should(await utils.exists(path.join(project.projectFolderPath, expectedFileName))).be.true(`File ${expectedFileName} should exist on disk for input ${testCase.input}`);

				// Clean up for next iteration
				await project.deleteSqlObjectScript(createdFile!.relativePath);
				sinon.restore();
			}
		});
	});
});

async function setupDeleteExcludeTest(proj: Project): Promise<[FileProjectEntry, ProjectRootTreeItem, FileProjectEntry, FileProjectEntry, FileProjectEntry]> {
	await proj.addFolder('UpperFolder');
	await proj.addFolder('UpperFolder/LowerFolder');
	const scriptEntry = await proj.addScriptItem('UpperFolder/LowerFolder/someScript.sql', 'not a real script');
	await proj.addScriptItem('UpperFolder/LowerFolder/someOtherScript.sql', 'Also not a real script');
	await proj.addScriptItem('../anotherScript.sql', 'Also not a real script');
	const preDeployEntry = await proj.addScriptItem('Script.PreDeployment1.sql', 'pre-deployment stuff', ItemType.preDeployScript);
	const noneEntry = await proj.addScriptItem('Script.PreDeployment2.sql', 'more pre-deployment stuff', ItemType.preDeployScript);
	const postDeployEntry = await proj.addScriptItem('Script.PostDeployment1.sql', 'post-deployment stuff', ItemType.postDeployScript);

	const projTreeRoot = new ProjectRootTreeItem(proj);
	sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(constants.yesString));

	// confirm setup
	should(proj.sqlObjectScripts.length).equal(3, 'number of file entries');
	should(proj.folders.length).equal(2, 'number of folder entries');
	should(proj.preDeployScripts.length).equal(1, 'number of pre-deployment script entries');
	should(proj.postDeployScripts.length).equal(1, 'number of post-deployment script entries');
	should(proj.noneDeployScripts.length).equal(1, 'number of none script entries');
	should(path.parse(scriptEntry.fsUri.fsPath).base).equal('someScript.sql');
	should((await fs.readFile(scriptEntry.fsUri.fsPath)).toString()).equal('not a real script');

	return [scriptEntry, projTreeRoot, preDeployEntry, postDeployEntry, noneEntry];
}

async function setupMoveTest(proj: Project): Promise<ProjectRootTreeItem> {
	await proj.addFolder('UpperFolder');
	await proj.addFolder('UpperFolder/LowerFolder');
	await proj.addFolder('folder1');
	await proj.addScriptItem('UpperFolder/LowerFolder/someScript.sql', 'not a real script');
	await proj.addScriptItem('UpperFolder/LowerFolder/someOtherScript.sql', 'Also not a real script');
	await proj.addScriptItem('../anotherScript.sql', 'Also not a real script');
	await proj.addScriptItem('script1.sql', 'Also not a real script');

	const projTreeRoot = new ProjectRootTreeItem(proj);
	return projTreeRoot;
}

function createWorkspaceTreeItem(node: BaseProjectTreeItem): dataworkspace.WorkspaceTreeItem {
	return {
		element: node,
		treeDataProvider: new SqlDatabaseProjectTreeViewProvider()
	};
}

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
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';
import * as testUtils from './testUtils';
import * as constants from '../common/constants';

import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { promises as fs } from 'fs';
import { createContext, TestContext, mockDacFxResult } from './testContext';
import { Project, SystemDatabase, ProjectEntry } from '../models/project';
import { DeployDatabaseDialog } from '../dialogs/deployDatabaseDialog';
import { ApiWrapper } from '../common/apiWrapper';
import { IDeploymentProfile, IGenerateScriptProfile } from '../models/IDeploymentProfile';
import { exists } from '../common/utils';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { FolderNode } from '../models/tree/fileFolderTreeItem';

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

beforeEach(async function (): Promise<void> {
	testContext = createContext();
});

describe('ProjectsController: project controller operations', function (): void {
	before(async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	describe('Project file operations and prompting', function (): void {
		it('Should create new sqlproj file with correct values', async function (): Promise<void> {
			const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
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

			const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

			const project = await projController.openProject(vscode.Uri.file(sqlProjPath));

			should(project.files.length).equal(9); // detailed sqlproj tests in their own test file
			should(project.dataSources.length).equal(2); // detailed datasources tests in their own test file
		});

		it('Should not keep failed to load project in project list.', async function (): Promise<void> {
			const folderPath = await testUtils.generateTestFolderPath();
			const sqlProjPath = await testUtils.createTestSqlProjFile('empty file with no valid xml', folderPath);
			const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

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
				testContext.apiWrapper.reset();
				testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(name));
				testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

				const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
				const project = new Project('FakePath');

				should(project.files.length).equal(0);
				await projController.addItemPrompt(new Project('FakePath'), '', templates.script);
				should(project.files.length).equal(0, 'Expected to return without throwing an exception or adding a file when an empty/undefined name is provided.');
			}
		});

		it('Should delete nested ProjectEntry from node', async function (): Promise<void> {
			let proj = await testUtils.createTestProject(templates.newSqlProjectTemplate);
			const setupResult = await setupDeleteExcludeTest(proj);
			const scriptEntry = setupResult[0], projTreeRoot = setupResult[1];

			const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

			await projController.delete(projTreeRoot.children.find(x => x.friendlyName === 'UpperFolder')!.children[0] /* LowerFolder */);

			proj = new Project(proj.projectFilePath);
			await proj.readProjFile(); // reload edited sqlproj from disk

			// confirm result
			should(proj.files.length).equal(2, 'number of file/folder entries'); // lowerEntry and the contained scripts should be deleted
			should(proj.files[1].relativePath).equal('UpperFolder');

			should(await exists(scriptEntry.fsUri.fsPath)).equal(false, 'script is supposed to be deleted');
		});

		it('Should exclude nested ProjectEntry from node', async function (): Promise<void> {
			let proj = await testUtils.createTestProject(templates.newSqlProjectTemplate);
			const setupResult = await setupDeleteExcludeTest(proj);
			const scriptEntry = setupResult[0], projTreeRoot = setupResult[1];

			const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

			await projController.exclude(<FolderNode>projTreeRoot.children.find(x => x.friendlyName === 'UpperFolder')!.children[0] /* LowerFolder */);

			proj = new Project(proj.projectFilePath);
			await proj.readProjFile(); // reload edited sqlproj from disk

			// confirm result
			should(proj.files.length).equal(2, 'number of file/folder entries'); // LowerFolder and the contained scripts should be deleted
			should(proj.files[1].relativePath).equal('UpperFolder'); // UpperFolder should still be there

			should(await exists(scriptEntry.fsUri.fsPath)).equal(true, 'script is supposed to still exist on disk');
		});
	});

	describe('Deployment and deployment script generation', function (): void {
		it('Deploy dialog should open from ProjectController', async function (): Promise<void> {
			let opened = false;

			let deployDialog = TypeMoq.Mock.ofType(DeployDatabaseDialog);
			deployDialog.setup(x => x.openDialog()).returns(() => { opened = true; });

			let projController = TypeMoq.Mock.ofType(ProjectsController);
			projController.callBase = true;
			projController.setup(x => x.getDeployDialog(TypeMoq.It.isAny())).returns(() => deployDialog.object);

			await projController.object.deployProject(new Project('FakePath'));
			should(opened).equal(true);
		});

		it('Callbacks are hooked up and called from Deploy dialog', async function (): Promise<void> {
			const projPath = path.dirname(await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline));
			await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, projPath);
			const proj = new Project(projPath);

			const deployHoller = 'hello from callback for deploy()';
			const generateHoller = 'hello from callback for generateScript()';
			const profileHoller = 'hello from callback for readPublishProfile()';

			let holler = 'nothing';

			let deployDialog = TypeMoq.Mock.ofType(DeployDatabaseDialog, undefined, undefined, new ApiWrapper(), proj);
			deployDialog.callBase = true;
			deployDialog.setup(x => x.getConnectionUri()).returns(async () => 'fake|connection|uri');

			let projController = TypeMoq.Mock.ofType(ProjectsController);
			projController.callBase = true;
			projController.setup(x => x.getDeployDialog(TypeMoq.It.isAny())).returns(() => deployDialog.object);
			projController.setup(x => x.executionCallback(TypeMoq.It.isAny(), TypeMoq.It.is((_): _ is IDeploymentProfile => true))).returns(async () => {
				holler = deployHoller;
				return undefined;
			});
			projController.setup(x => x.readPublishProfile(TypeMoq.It.isAny())).returns(async () => {
				holler = profileHoller;
				return {
					databaseName: '',
					sqlCmdVariables: {}
				};
			});

			projController.setup(x => x.executionCallback(TypeMoq.It.isAny(), TypeMoq.It.is((_): _ is IGenerateScriptProfile => true))).returns(async () => {
				holler = generateHoller;
				return undefined;
			});

			let dialog = await projController.object.deployProject(proj);
			await dialog.deployClick();

			should(holler).equal(deployHoller, 'executionCallback() is supposed to have been setup and called for Deploy scenario');

			dialog = await projController.object.deployProject(proj);
			await dialog.generateScriptClick();

			should(holler).equal(generateHoller, 'executionCallback() is supposed to have been setup and called for GenerateScript scenario');

			dialog = await projController.object.deployProject(proj);
			await projController.object.readPublishProfile(vscode.Uri.parse('test'));

			should(holler).equal(profileHoller, 'executionCallback() is supposed to have been setup and called for ReadPublishProfile scenario');
		});

		it('Should read database name and SQLCMD variables from publish profile', async function (): Promise<void> {
			await baselines.loadBaselines();
			let profilePath = await testUtils.createTestFile(baselines.publishProfileBaseline, 'publishProfile.publish.xml');
			const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

			let result = await projController.readPublishProfile(vscode.Uri.file(profilePath));
			should(result.databaseName).equal('targetDb');
			should(Object.keys(result.sqlCmdVariables).length).equal(1);
			should(result.sqlCmdVariables['ProdDatabaseName']).equal('MyProdDatabase');
		});

		it('Should copy dacpac to temp folder before deploying', async function (): Promise<void> {
			const fakeDacpacContents = 'SwiftFlewHiawathasArrow';
			let postCopyContents = '';
			let builtDacpacPath = '';
			let deployedDacpacPath = '';

			testContext.dacFxService.setup(x => x.generateDeployScript(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async (p) => {
				deployedDacpacPath = p;
				postCopyContents = (await fs.readFile(deployedDacpacPath)).toString();
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
			should(deployedDacpacPath).not.equal('', 'deployed dacpac path should be set');
			should(builtDacpacPath).not.equal(deployedDacpacPath, 'built and deployed dacpac paths should be different');
			should(postCopyContents).equal(fakeDacpacContents, 'contents of built and deployed dacpacs should match');
		});
	});
});

describe('ProjectsController: import operations', function (): void {
	it('Should create list of all files and folders correctly', async function (): Promise<void> {
		const testFolderPath = await testUtils.createDummyFileStructure();

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		const fileList = await projController.generateList(testFolderPath);

		should(fileList.length).equal(15);	// Parent folder + 2 files under parent folder + 2 directories with 5 files each
	});

	it('Should error out for inaccessible path', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		let testFolderPath = await testUtils.generateTestFolderPath();
		testFolderPath += '_nonexistentFolder';	// Modify folder path to point to a nonexistent location

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

		await testUtils.shouldThrowSpecificError(async () => await projController.generateList(testFolderPath), constants.cannotResolvePath(testFolderPath));
	});

	it('Should show error when no project name provided', async function (): Promise<void> {
		for (const name of ['', '    ', undefined]) {
			testContext.apiWrapper.reset();
			testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(name));
			testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

			const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
			await testUtils.shouldThrowSpecificError(async () => await projController.importNewDatabaseProject({ connectionProfile: mockConnectionProfile }), constants.projectNameRequired, `case: '${name}'`);
		}
	});

	it('Should show error when no target information provided', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('MyProjectName'));
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		await testUtils.shouldThrowSpecificError(async () => await projController.importNewDatabaseProject({ connectionProfile: mockConnectionProfile }), constants.extractTargetRequired);
	});

	it('Should show error when no location provided with ExtractTarget = File', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('MyProjectName'));
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ label: 'File' }));
		testContext.apiWrapper.setup(x => x.showSaveDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		await testUtils.shouldThrowSpecificError(async () => await projController.importNewDatabaseProject({ connectionProfile: mockConnectionProfile }), constants.projectLocationRequired);
	});

	it('Should show error when no location provided with ExtractTarget = SchemaObjectType', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('MyProjectName'));
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ label: 'SchemaObjectType' }));
		testContext.apiWrapper.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		testContext.apiWrapper.setup(x => x.workspaceFolders()).returns(() => undefined);
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		await testUtils.shouldThrowSpecificError(async () => await projController.importNewDatabaseProject({ connectionProfile: mockConnectionProfile }), constants.projectLocationRequired);
	});

	it('Should show error when selected folder is not empty', async function (): Promise<void> {
		const testFolderPath = await testUtils.createDummyFileStructure();

		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('MyProjectName'));
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ label: 'ObjectType' }));
		testContext.apiWrapper.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve([vscode.Uri.file(testFolderPath)]));
		testContext.apiWrapper.setup(x => x.workspaceFolders()).returns(() => undefined);
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

		await testUtils.shouldThrowSpecificError(async () => await projController.importNewDatabaseProject({ connectionProfile: mockConnectionProfile }), constants.projectLocationNotEmpty);
	});
});

describe('ProjectsController: add database reference operations', function (): void {
	it('Should show error when no reference type is selected', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		await testUtils.shouldThrowSpecificError(async () => await projController.addDatabaseReference(new Project('FakePath')), constants.databaseReferenceTypeRequired);
	});

	it('Should show error when no file is selected', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ label: constants.dacpac }));
		testContext.apiWrapper.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		await testUtils.shouldThrowSpecificError(async () => await projController.addDatabaseReference(new Project('FakePath')), constants.dacpacFileLocationRequired);
	});

	it('Should show error when no database name is provided', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ label: constants.dacpac }));
		testContext.apiWrapper.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve([vscode.Uri.file('FakePath')]));
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny())).returns(() => Promise.resolve({ label: constants.databaseReferenceDifferentDabaseSameServer }));
		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		await testUtils.shouldThrowSpecificError(async () => await projController.addDatabaseReference(new Project('FakePath')), constants.databaseNameRequired);
	});

	it('Should return the correct system database', async function (): Promise<void> {
		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline);
		const project: Project = new Project(projFilePath);
		await project.readProjFile();

		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ label: constants.master }));
		let systemDb = await projController.getSystemDatabaseName(project);
		should.equal(systemDb, SystemDatabase.master);

		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ label: constants.msdb }));
		systemDb = await projController.getSystemDatabaseName(project);
		should.equal(systemDb, SystemDatabase.msdb);

		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		await testUtils.shouldThrowSpecificError(async () => await projController.getSystemDatabaseName(project), constants.systemDatabaseReferenceRequired);
	});
});

describe('ProjectsController: round trip feature with SSDT', function (): void {
	it('Should show warning message for SSDT project opened in Azure Data Studio', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.SSDTProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

		await testUtils.shouldThrowSpecificError(async () => await projController.openProject(vscode.Uri.file(sqlProjPath)), constants.updateProjectForRoundTrip);
	});

	it('Should not show warning message for non-SSDT projects that have the additional information for Build', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

		const project = await projController.openProject(vscode.Uri.file(sqlProjPath));	// no error thrown

		should(project.importedTargets.length).equal(3); // additional target should exist by default
	});

	it('Should not update project and no backup file should be created when update to project is rejected', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(constants.noString));

		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.SSDTProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

		const project = await projController.openProject(vscode.Uri.file(sqlProjPath));

		should(await exists(sqlProjPath + '_backup')).equal(false);	// backup file should not be generated
		should(project.importedTargets.length).equal(2); // additional target should not be added by updateProjectForRoundTrip method
	});

	it('Should load Project and associated import targets when update to project is accepted', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(constants.yesString));

		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.SSDTProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

		const project = await projController.openProject(vscode.Uri.file(sqlProjPath));

		should(await exists(sqlProjPath + '_backup')).equal(true);	// backup file should be generated before the project is updated
		should(project.importedTargets.length).equal(3); // additional target added by updateProjectForRoundTrip method
	});
});

async function setupDeleteExcludeTest(proj: Project): Promise<[ProjectEntry, ProjectRootTreeItem]> {
	await proj.addFolderItem('UpperFolder');
	await proj.addFolderItem('UpperFolder/LowerFolder');
	const scriptEntry = await proj.addScriptItem('UpperFolder/LowerFolder/someScript.sql', 'not a real script');
	await proj.addScriptItem('UpperFolder/LowerFolder/someOtherScript.sql', 'Also not a real script');

	const projTreeRoot = new ProjectRootTreeItem(proj);

	testContext.apiWrapper.setup(x => x.showWarningMessageOptions(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(constants.yesString));

	// confirm setup
	should(proj.files.length).equal(5, 'number of file/folder entries');
	should(path.parse(scriptEntry.fsUri.fsPath).base).equal('someScript.sql');
	should((await fs.readFile(scriptEntry.fsUri.fsPath)).toString()).equal('not a real script');

	return [scriptEntry, projTreeRoot];
}

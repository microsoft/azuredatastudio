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
import { createContext, TestContext } from './testContext';
import { Project } from '../models/project';

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

describe('ProjectsController: project controller operations', function (): void {
	before(async function (): Promise<void> {
		testContext = createContext();
		await templates.loadTemplates(path.join(__dirname, '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	it('Should create new sqlproj file with correct values', async function (): Promise<void> {
		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

		const projFilePath = await projController.createNewProject('TestProjectName', vscode.Uri.file(projFileDir), 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575');

		let projFileText = (await fs.readFile(projFilePath)).toString();

		should(projFileText).equal(baselines.newProjectFileBaseline);
	});

	it('Should load Project and associated DataSources', async function (): Promise<void> {
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProj(baselines.openProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

		const project = await projController.openProject(vscode.Uri.file(sqlProjPath));

		should(project.files.length).equal(9); // detailed sqlproj tests in their own test file
		should(project.dataSources.length).equal(2); // detailed datasources tests in their own test file
	});

	it('Should return silently when no object name provided', async function (): Promise<void> {
		for (const name of ['', '    ', undefined]) {
			testContext.apiWrapper.reset();
			testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(name));
			testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { console.log('we throwin'); throw new Error(s); });

			const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
			const project = new Project('FakePath');

			should(project.files.length).equal(0);
			await projController.addItemPrompt(new Project('FakePath'), '', templates.script);
			should(project.files.length).equal(0, 'Expected to return without throwing an exception or adding a file when an empty/undefined name is provided.');
		}
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
		let testFolderPath = await testUtils.generateTestFolderPath();
		testFolderPath += '_nonExistant';	// Modify folder path to point to a non-existant location

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());

		await testUtils.shouldThrowSpecificError(async () => await projController.generateList(testFolderPath), constants.cannotResolvePath(testFolderPath));
	});

	it('Should show error when no project name provided', async function (): Promise<void> {
		for (const name of ['', '    ', undefined]) {
			testContext.apiWrapper.reset();
			testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(name));
			testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

			const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
			await testUtils.shouldThrowSpecificError(async () => await projController.importNewDatabaseProject(mockConnectionProfile), constants.projectNameRequired, `case: '${name}'`);
		}
	});

	it('Should show error when no target information provided', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('MyProjectName'));
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		await testUtils.shouldThrowSpecificError(async () => await projController.importNewDatabaseProject(mockConnectionProfile), constants.extractTargetRequired);
	});

	it('Should show error when no location provided with ExtractTarget = File', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('MyProjectName'));
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({label: 'File'}));
		testContext.apiWrapper.setup(x => x.showSaveDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		await testUtils.shouldThrowSpecificError(async () => await projController.importNewDatabaseProject(mockConnectionProfile), constants.projectLocationRequired);
	});

	it('Should show error when no location provided with ExtractTarget = SchemaObjectType', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('MyProjectName'));
		testContext.apiWrapper.setup(x => x.showQuickPick(TypeMoq.It.isAny())).returns(() => Promise.resolve({label: 'SchemaObjectType'}));
		testContext.apiWrapper.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		testContext.apiWrapper.setup(x => x.workspaceFolders()).returns(() => undefined);
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		await testUtils.shouldThrowSpecificError(async () => await projController.importNewDatabaseProject(mockConnectionProfile), constants.projectLocationRequired);
	});
});

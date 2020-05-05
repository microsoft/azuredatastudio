/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';
import * as testUtils from './testUtils';

import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { promises as fs } from 'fs';
import { createContext, TestContext } from './testContext';
import { Project } from '../models/project';

let testContext: TestContext;

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

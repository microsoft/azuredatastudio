/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';

import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { promises as fs } from 'fs';

before(async function () : Promise<void> {
	await templates.loadTemplates('..\\..\\extensions\\sql-database-projects\\resources\\templates');
	await baselines.loadBaselines('..\\..\\extensions\\sql-database-projects\\src\\test\\baselines');
});

describe('SqlDatabaseProjectTreeViewProvider: project controller operations', function (): void {
	it('Should create new sqlproj file with correct values', async function (): Promise<void> {
		const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
		const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

		const projFilePath = await projController.createNewProject('TestProjectName', vscode.Uri.file(projFileDir), 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575');

		let projFileText = (await fs.readFile(projFilePath)).toString();

		should(projFileText).equal(baselines.newProjectFileBaseline);
	});

	it('Should load Project and associated DataSources', async function (): Promise<void> {

	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as baselines from './baselines';
import * as testUtils from './testUtils';

import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { promises as fs } from 'fs';
import { EntryType } from '../models/project';

describe('Sqlproj file operations', function (): void {
	it('Should create new sqlproj file with correct values', async function (): Promise<void> {
		const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
		const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

		const projFilePath = await projController.createNewProject('TestProjectName', vscode.Uri.file(projFileDir), 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575');

		let projFileText = (await fs.readFile(projFilePath)).toString();

		should(projFileText).equal(baselines.newProjectFileBaseline);
	});

	it('Should open a sqlproj with nested and unnested contents', async function (): Promise<void> {
		const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
		const projFilePath = await testUtils.createTestSqlProj(baselines.openProjectFileBaseline);

		const project = await projController.openProject(vscode.Uri.file(projFilePath));

		should(project.files.filter(f => f.type === EntryType.File).length).equal(4);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(5);

		should(project.files.find(f => f.type === EntryType.Folder && f.relativePath === 'Views\\User')).not.equal(undefined); // mixed ItemGroup folder
		should(project.files.find(f => f.type === EntryType.File && f.relativePath === 'Views\\User\\Profile.sql')).not.equal(undefined); // mixed ItemGroup file
	});
});


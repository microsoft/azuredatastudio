/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as vscode from 'vscode';
import * as baselines from './baselines';
import * as testUtils from './testUtils';

import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { promises as fs } from 'fs';
import { Project, EntryType } from '../models/project';

let projController: ProjectsController;
let testProject: Project;

describe('Sqlproj content operations', function (): void {
	beforeEach(async () => {
		projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
		const projFilePath = await testUtils.createTestSqlProj(baselines.openProjectFileBaseline);
		testProject = await projController.openProject(vscode.Uri.file(projFilePath));
	});

	it('Should add Folder and Build entries to sqlproj', async function (): Promise<void> {
		const folderPath = 'Stored Procedures';
		const filePath = path.join(folderPath, 'Fake Stored Proc.sql');
		const fileContents = 'SELECT \'This is not actually a stored procedure.\'';

		await testProject.addFolderItem(folderPath);
		await testProject.addScriptItem(filePath, fileContents);

		const newProject = await projController.openProject(vscode.Uri.file(testProject.projectFilePath));

		should(newProject.files.find(f => f.type === EntryType.Folder && f.relativePath === folderPath)).not.equal(undefined);
		should(newProject.files.find(f => f.type === EntryType.File && f.relativePath === filePath)).not.equal(undefined);

		const newFileContents = (await fs.readFile(path.join(newProject.projectFolderPath, filePath))).toString();

		should (newFileContents).equal(fileContents);
	});
});

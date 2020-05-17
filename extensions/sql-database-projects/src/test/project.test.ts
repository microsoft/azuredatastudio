/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as baselines from './baselines/baselines';
import * as testUtils from './testUtils';

import { promises as fs } from 'fs';
import { Project, EntryType } from '../models/project';

let projFilePath: string;

describe('Project: sqlproj content operations', function (): void {
	before(async function () : Promise<void> {
		await baselines.loadBaselines();
	});

	beforeEach(async () => {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline);
	});

	it('Should read Project from sqlproj', async function (): Promise<void> {
		const project: Project = new Project(projFilePath);
		await project.readProjFile();

		should(project.files.filter(f => f.type === EntryType.File).length).equal(4);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(5);

		should(project.files.find(f => f.type === EntryType.Folder && f.relativePath === 'Views\\User')).not.equal(undefined); // mixed ItemGroup folder
		should(project.files.find(f => f.type === EntryType.File && f.relativePath === 'Views\\User\\Profile.sql')).not.equal(undefined); // mixed ItemGroup file
	});

	it('Should add Folder and Build entries to sqlproj', async function (): Promise<void> {
		const project: Project = new Project(projFilePath);
		await project.readProjFile();

		const folderPath = 'Stored Procedures';
		const filePath = path.join(folderPath, 'Fake Stored Proc.sql');
		const fileContents = 'SELECT \'This is not actually a stored procedure.\'';

		await project.addFolderItem(folderPath);
		await project.addScriptItem(filePath, fileContents);

		const newProject = new Project(projFilePath);
		await newProject.readProjFile();

		should(newProject.files.find(f => f.type === EntryType.Folder && f.relativePath === folderPath)).not.equal(undefined);
		should(newProject.files.find(f => f.type === EntryType.File && f.relativePath === filePath)).not.equal(undefined);

		const newFileContents = (await fs.readFile(path.join(newProject.projectFolderPath, filePath))).toString();

		should (newFileContents).equal(fileContents);
	});
});

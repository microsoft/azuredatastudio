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
import { exists } from '../common/utils';

let projFilePath: string;

describe('Project: sqlproj content operations', function (): void {
	before(async function() : Promise<void> {
		await baselines.loadBaselines();
	});

	beforeEach(async () => {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline);
	});

	it('Should read Project from sqlproj', async function (): Promise<void> {
		const project: Project = new Project(projFilePath);
		await project.readProjFile();

		// Files and folders
		should(project.files.filter(f => f.type === EntryType.File).length).equal(4);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(5);

		should(project.files.find(f => f.type === EntryType.Folder && f.relativePath === 'Views\\User')).not.equal(undefined); // mixed ItemGroup folder
		should(project.files.find(f => f.type === EntryType.File && f.relativePath === 'Views\\User\\Profile.sql')).not.equal(undefined); // mixed ItemGroup file

		// SqlCmdVariables
		should(Object.keys(project.sqlCmdVariables).length).equal(2);
		should(project.sqlCmdVariables['ProdDatabaseName']).equal('MyProdDatabase');
		should(project.sqlCmdVariables['BackupDatabaseName']).equal('MyBackupDatabase');
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

		should(newFileContents).equal(fileContents);
	});

	it('Should add Folder and Build entries to sqlproj with pre-existing scripts on disk', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project: Project = new Project(projFilePath);
		await project.readProjFile();

		let list: string[] = await testUtils.createListOfFiles(path.dirname(projFilePath));

		await project.addToProject(list);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);	// txt file shouldn't be added to the project
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(3);	// 2folders + default Properties folder
	});

	it('Should throw error while adding Folder and Build entries to sqlproj when a file/folder does not exist on disk', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = new Project(projFilePath);
		await project.readProjFile();

		let list: string[] = [];
		let testFolderPath: string = await testUtils.createDummyFileStructure(true, list, path.dirname(projFilePath));

		const nonexistentFile = path.join(testFolderPath, 'nonexistentFile.sql');
		list.push(nonexistentFile);

		await testUtils.shouldThrowSpecificError(async () => await project.addToProject(list), `ENOENT: no such file or directory, stat \'${nonexistentFile}\'`);
	});
});

describe('Project: round trip updates', function (): void {
	before(async function () : Promise<void> {
		await baselines.loadBaselines();
	});

	it('Should update SSDT project to work in ADS', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.SSDTProjectFileBaseline);
		const project: Project = new Project(projFilePath);
		await project.readProjFile();

		await project.updateProjectForRoundTrip();

		should(await exists(projFilePath + '_backup')).equal(true);	// backup file should be generated before the project is updated
		should(project.importedTargets.length).equal(3);	// additional target added by updateProjectForRoundTrip method

		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).equal(baselines.SSDTProjectAfterUpdateBaseline.trim());
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as baselines from './baselines/baselines';
import * as testUtils from './testUtils';
import * as constants from '../common/constants';

import { promises as fs } from 'fs';
import { Project, EntryType, TargetPlatform, SystemDatabase, DatabaseReferenceLocation } from '../models/project';
import { exists, convertSlashesForSqlProj } from '../common/utils';
import { Uri } from 'vscode';

let projFilePath: string;

describe('Project: sqlproj content operations', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	beforeEach(async () => {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline);
	});

	it('Should read Project from sqlproj', async function (): Promise<void> {
		const project: Project = await Project.openProject(projFilePath);

		// Files and folders
		should(project.files.filter(f => f.type === EntryType.File).length).equal(5);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(4);

		should(project.files.find(f => f.type === EntryType.Folder && f.relativePath === 'Views\\User')).not.equal(undefined); // mixed ItemGroup folder
		should(project.files.find(f => f.type === EntryType.File && f.relativePath === 'Views\\User\\Profile.sql')).not.equal(undefined); // mixed ItemGroup file
		should(project.files.find(f => f.type === EntryType.File && f.relativePath === '..\\Test\\Test.sql')).not.equal(undefined); // mixed ItemGroup file

		// SqlCmdVariables
		should(Object.keys(project.sqlCmdVariables).length).equal(2);
		should(project.sqlCmdVariables['ProdDatabaseName']).equal('MyProdDatabase');
		should(project.sqlCmdVariables['BackupDatabaseName']).equal('MyBackupDatabase');

		// Database references
		// should only have one database reference even though there are two master.dacpac references (1 for ADS and 1 for SSDT)
		should(project.databaseReferences.length).equal(1);
		should(project.databaseReferences[0].databaseName).containEql(constants.master);
	});

	it('Should add Folder and Build entries to sqlproj', async function (): Promise<void> {
		const project = await Project.openProject(projFilePath);

		const folderPath = 'Stored Procedures';
		const filePath = path.join(folderPath, 'Fake Stored Proc.sql');
		const fileContents = 'SELECT \'This is not actually a stored procedure.\'';

		await project.addFolderItem(folderPath);
		await project.addScriptItem(filePath, fileContents);

		const newProject = await Project.openProject(projFilePath);

		should(newProject.files.find(f => f.type === EntryType.Folder && f.relativePath === convertSlashesForSqlProj(folderPath))).not.equal(undefined);
		should(newProject.files.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(filePath))).not.equal(undefined);

		const newFileContents = (await fs.readFile(path.join(newProject.projectFolderPath, filePath))).toString();

		should(newFileContents).equal(fileContents);
	});

	it('Should add Folder and Build entries to sqlproj with pre-existing scripts on disk', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		let list: string[] = await testUtils.createListOfFiles(path.dirname(projFilePath));

		await project.addToProject(list);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);	// txt file shouldn't be added to the project
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(2);	// 2 folders
	});

	it('Should throw error while adding Folder and Build entries to sqlproj when a file/folder does not exist on disk', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		let list: string[] = [];
		let testFolderPath: string = await testUtils.createDummyFileStructure(true, list, path.dirname(projFilePath));

		const nonexistentFile = path.join(testFolderPath, 'nonexistentFile.sql');
		list.push(nonexistentFile);

		await testUtils.shouldThrowSpecificError(async () => await project.addToProject(list), `ENOENT: no such file or directory, stat \'${nonexistentFile}\'`);
	});

	it('Should choose correct master dacpac', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		let uri = project.getSystemDacpacUri(constants.masterDacpac);
		let ssdtUri = project.getSystemDacpacSsdtUri(constants.masterDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', '130', constants.masterDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', '130', 'SqlSchemas', constants.masterDacpac)).fsPath);

		project.changeDSP(TargetPlatform.Sql150.toString());
		uri = project.getSystemDacpacUri(constants.masterDacpac);
		ssdtUri = project.getSystemDacpacSsdtUri(constants.masterDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', '150', constants.masterDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', '150', 'SqlSchemas', constants.masterDacpac)).fsPath);

		project.changeDSP(TargetPlatform.SqlAzureV12.toString());
		uri = project.getSystemDacpacUri(constants.masterDacpac);
		ssdtUri = project.getSystemDacpacSsdtUri(constants.masterDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', 'AzureV12',constants.masterDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', 'AzureV12', 'SqlSchemas', constants.masterDacpac)).fsPath);
	});

	it('Should choose correct msdb dacpac', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		let uri = project.getSystemDacpacUri(constants.msdbDacpac);
		let ssdtUri = project.getSystemDacpacSsdtUri(constants.msdbDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', '130', constants.msdbDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', '130', 'SqlSchemas', constants.msdbDacpac)).fsPath);

		project.changeDSP(TargetPlatform.Sql150.toString());
		uri = project.getSystemDacpacUri(constants.msdbDacpac);
		ssdtUri = project.getSystemDacpacSsdtUri(constants.msdbDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', '150', constants.msdbDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', '150', 'SqlSchemas', constants.msdbDacpac)).fsPath);

		project.changeDSP(TargetPlatform.SqlAzureV12.toString());
		uri = project.getSystemDacpacUri(constants.msdbDacpac);
		ssdtUri = project.getSystemDacpacSsdtUri(constants.msdbDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', 'AzureV12', constants.msdbDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', 'AzureV12', 'SqlSchemas', constants.msdbDacpac)).fsPath);
	});

	it('Should throw error when choosing correct master dacpac if invalid DSP', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		project.changeDSP('invalidPlatform');
		await testUtils.shouldThrowSpecificError(async () => await project.getSystemDacpacUri(constants.masterDacpac), constants.invalidDataSchemaProvider);
	});

	it('Should add database references correctly', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no datbase references to start with');
		await project.addSystemDatabaseReference(SystemDatabase.master);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to master');
		should(project.databaseReferences[0].databaseName).equal(constants.master, 'The database reference should be master');
		// make sure reference to SSDT master dacpac was added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql(convertSlashesForSqlProj(project.getSystemDacpacSsdtUri(constants.master).fsPath.substring(1)));

		await project.addSystemDatabaseReference(SystemDatabase.msdb);
		should(project.databaseReferences.length).equal(2, 'There should be two database references after adding a reference to msdb');
		should(project.databaseReferences[1].databaseName).equal(constants.msdb, 'The database reference should be msdb');
		// make sure reference to SSDT msdb dacpac was added
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql(convertSlashesForSqlProj(project.getSystemDacpacSsdtUri(constants.msdb).fsPath.substring(1)));

		await project.addDatabaseReference(Uri.parse('test.dacpac'), DatabaseReferenceLocation.sameDatabase);
		should(project.databaseReferences.length).equal(3, 'There should be three database references after adding a reference to test');
		should(project.databaseReferences[2].databaseName).equal('test', 'The database reference should be test');
	});

	it('Should not allow adding duplicate database references', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		await project.addSystemDatabaseReference(SystemDatabase.master);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to master');
		should(project.databaseReferences[0].databaseName).equal(constants.master, 'project.databaseReferences[0].databaseName should be master');

		// try to add reference to master again
		await testUtils.shouldThrowSpecificError(async () => await project.addSystemDatabaseReference(SystemDatabase.master), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(1, 'There should only be one database reference after trying to add a reference to master again');

		await project.addDatabaseReference(Uri.parse('test.dacpac'), DatabaseReferenceLocation.sameDatabase);
		should(project.databaseReferences.length).equal(2, 'There should be two database references after adding a reference to test.dacpac');
		should(project.databaseReferences[1].databaseName).equal('test', 'project.databaseReferences[1].databaseName should be test');

		// try to add reference to test.dacpac again
		await testUtils.shouldThrowSpecificError(async () => await project.addDatabaseReference(Uri.parse('test.dacpac'), DatabaseReferenceLocation.sameDatabase), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(2, 'There should be two database references after trying to add a reference to test.dacpac again');
	});
});

describe('Project: round trip updates', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	it('Should update SSDT project to work in ADS', async function (): Promise<void> {
		await testUpdateInRoundTrip( baselines.SSDTProjectFileBaseline, baselines.SSDTProjectAfterUpdateBaseline, true, true);
	});

	it('Should update SSDT project with new system database references', async function (): Promise<void> {
		await testUpdateInRoundTrip(baselines.SSDTUpdatedProjectBaseline, baselines.SSDTUpdatedProjectAfterSystemDbUpdateBaseline, false, true);
	});

	it('Should update SSDT project to work in ADS handling pre-exsiting targets', async function (): Promise<void> {
		await testUpdateInRoundTrip(baselines.SSDTProjectBaselineWithCleanTarget, baselines.SSDTProjectBaselineWithCleanTargetAfterUpdate, true, false);
	});
});

async function testUpdateInRoundTrip(fileBeforeupdate: string, fileAfterUpdate: string, testTargets: boolean, testReferences: boolean): Promise<void> {
	projFilePath = await testUtils.createTestSqlProjFile(fileBeforeupdate);
	const project = await Project.openProject(projFilePath);

	if (testTargets) {
		await testUpdateTargetsImportsRoundTrip(project);
	}

	if (testReferences) {
		await testAddReferencesInRoundTrip(project);
	}

	let projFileText = (await fs.readFile(projFilePath)).toString();
	should(projFileText).equal(fileAfterUpdate.trim());
}

async function testUpdateTargetsImportsRoundTrip(project: Project): Promise<void> {
	should(project.importedTargets.length).equal(2);
	await project.updateProjectForRoundTrip();
	should(await exists(projFilePath + '_backup')).equal(true);	// backup file should be generated before the project is updated
	should(project.importedTargets.length).equal(3);	// additional target added by updateProjectForRoundTrip method
}

async function testAddReferencesInRoundTrip(project: Project): Promise<void> {
	// updating system db refs is separate from updating for roundtrip because new db refs could be added even after project is updated for roundtrip
	should(project.containsSSDTOnlySystemDatabaseReferences()).equal(true);
	await project.updateSystemDatabaseReferencesInProjFile();
}

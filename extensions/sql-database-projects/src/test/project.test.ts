/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as sinon from 'sinon';
import * as baselines from './baselines/baselines';
import * as testUtils from './testUtils';
import * as constants from '../common/constants';

import { promises as fs } from 'fs';
import { Project } from '../models/project';
import { exists, convertSlashesForSqlProj, getWellKnownDatabaseSources } from '../common/utils';
import { Uri, window } from 'vscode';
import { IDacpacReferenceSettings, IProjectReferenceSettings, ISystemDatabaseReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { EntryType, ItemType, SqlTargetPlatform } from 'sqldbproj';
import { SystemDatabaseReferenceProjectEntry, SqlProjectReferenceProjectEntry, SystemDatabase } from '../models/projectEntry';

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
		should(project.files.filter(f => f.type === EntryType.File).length).equal(6);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(4);

		should(project.files.find(f => f.type === EntryType.Folder && f.relativePath === 'Views\\User\\')).not.equal(undefined); // mixed ItemGroup folder
		should(project.files.find(f => f.type === EntryType.File && f.relativePath === 'Views\\User\\Profile.sql')).not.equal(undefined); // mixed ItemGroup file
		should(project.files.find(f => f.type === EntryType.File && f.relativePath === '..\\Test\\Test.sql')).not.equal(undefined); // mixed ItemGroup file
		should(project.files.find(f => f.type === EntryType.File && f.relativePath === 'MyExternalStreamingJob.sql')).not.equal(undefined); // entry with custom attribute


		// SqlCmdVariables
		should(Object.keys(project.sqlCmdVariables).length).equal(2);
		should(project.sqlCmdVariables['ProdDatabaseName']).equal('MyProdDatabase');
		should(project.sqlCmdVariables['BackupDatabaseName']).equal('MyBackupDatabase');

		// Database references
		// should only have one database reference even though there are two master.dacpac references (1 for ADS and 1 for SSDT)
		should(project.databaseReferences.length).equal(1);
		should(project.databaseReferences[0].databaseName).containEql(constants.master);
		should(project.databaseReferences[0] instanceof SystemDatabaseReferenceProjectEntry).equal(true);

		// Pre-post deployment scripts
		should(project.preDeployScripts.length).equal(1);
		should(project.postDeployScripts.length).equal(1);
		should(project.noneDeployScripts.length).equal(2);
		should(project.preDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Script.PreDeployment1.sql')).not.equal(undefined, 'File Script.PreDeployment1.sql not read');
		should(project.postDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Script.PostDeployment1.sql')).not.equal(undefined, 'File Script.PostDeployment1.sql not read');
		should(project.noneDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Script.PreDeployment2.sql')).not.equal(undefined, 'File Script.PostDeployment2.sql not read');
		should(project.noneDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Tables\\Script.PostDeployment1.sql')).not.equal(undefined, 'File Tables\\Script.PostDeployment1.sql not read');
	});

	it('Should read Project with Project reference from sqlproj', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openProjectWithProjectReferencesBaseline);
		const project: Project = await Project.openProject(projFilePath);

		// Database references
		// should only have two database references even though there are two master.dacpac references (1 for ADS and 1 for SSDT)
		should(project.databaseReferences.length).equal(2);
		should(project.databaseReferences[0].databaseName).containEql(constants.master);
		should(project.databaseReferences[0] instanceof SystemDatabaseReferenceProjectEntry).equal(true);
		should(project.databaseReferences[1].databaseName).containEql('TestProjectName');
		should(project.databaseReferences[1] instanceof SqlProjectReferenceProjectEntry).equal(true);
	});

	it('Should throw warning message while reading Project with more than 1 pre-deploy script from sqlproj', async function (): Promise<void> {
		const stub = sinon.stub(window, 'showWarningMessage').returns(<any>Promise.resolve(constants.okString));

		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSqlProjectWithPrePostDeploymentError);
		const project: Project = await Project.openProject(projFilePath);

		should(stub.calledOnce).be.true('showWarningMessage should have been called exactly once');
		should(stub.calledWith(constants.prePostDeployCount)).be.true(`showWarningMessage not called with expected message '${constants.prePostDeployCount}' Actual '${stub.getCall(0).args[0]}'`);

		should(project.preDeployScripts.length).equal(2);
		should(project.postDeployScripts.length).equal(1);
		should(project.noneDeployScripts.length).equal(1);
		should(project.preDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Script.PreDeployment1.sql')).not.equal(undefined, 'File Script.PreDeployment1.sql not read');
		should(project.postDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Script.PostDeployment1.sql')).not.equal(undefined, 'File Script.PostDeployment1.sql not read');
		should(project.preDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Script.PreDeployment2.sql')).not.equal(undefined, 'File Script.PostDeployment2.sql not read');
		should(project.noneDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Tables\\Script.PostDeployment1.sql')).not.equal(undefined, 'File Tables\\Script.PostDeployment1.sql not read');

		sinon.restore();
	});

	it('Should add Folder and Build entries to sqlproj', async function (): Promise<void> {
		const project = await Project.openProject(projFilePath);

		const folderPath = 'Stored Procedures\\';
		const scriptPath = path.join(folderPath, 'Fake Stored Proc.sql');
		const scriptContents = 'SELECT \'This is not actually a stored procedure.\'';

		const scriptPathTagged = path.join(folderPath, 'Fake External Streaming Job.sql');
		const scriptContentsTagged = 'EXEC sys.sp_create_streaming_job \'job\', \'SELECT 7\'';

		await project.addFolderItem(folderPath);
		await project.addScriptItem(scriptPath, scriptContents);
		await project.addScriptItem(scriptPathTagged, scriptContentsTagged, ItemType.externalStreamingJob);

		const newProject = await Project.openProject(projFilePath);

		should(newProject.files.find(f => f.type === EntryType.Folder && f.relativePath === convertSlashesForSqlProj(folderPath))).not.equal(undefined);
		should(newProject.files.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(scriptPath))).not.equal(undefined);
		should(newProject.files.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(scriptPathTagged))).not.equal(undefined);
		should(newProject.files.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(scriptPathTagged))?.sqlObjectType).equal(constants.ExternalStreamingJob);

		const newScriptContents = (await fs.readFile(path.join(newProject.projectFolderPath, scriptPath))).toString();

		should(newScriptContents).equal(scriptContents);
	});

	it('Should add Folder and Build entries to sqlproj with pre-existing scripts on disk', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		let list: Uri[] = await testUtils.createListOfFiles(path.dirname(projFilePath));

		await project.addToProject(list);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);	// txt file shouldn't be added to the project
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(2);	// 2 folders
	});

	it('Should throw error while adding Folder and Build entries to sqlproj when a file/folder does not exist on disk', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		let list: Uri[] = [];
		let testFolderPath: string = await testUtils.createDummyFileStructure(true, list, path.dirname(projFilePath));

		const nonexistentFile = path.join(testFolderPath, 'nonexistentFile.sql');
		list.push(Uri.file(nonexistentFile));

		await testUtils.shouldThrowSpecificError(async () => await project.addToProject(list), constants.fileOrFolderDoesNotExist(Uri.file(nonexistentFile).fsPath));
	});

	it('Should choose correct master dacpac', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		let uri = project.getSystemDacpacUri(constants.masterDacpac);
		let ssdtUri = project.getSystemDacpacSsdtUri(constants.masterDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', '150', constants.masterDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', '150', 'SqlSchemas', constants.masterDacpac)).fsPath);

		await project.changeTargetPlatform(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2016)!);
		uri = project.getSystemDacpacUri(constants.masterDacpac);
		ssdtUri = project.getSystemDacpacSsdtUri(constants.masterDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', '130', constants.masterDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', '130', 'SqlSchemas', constants.masterDacpac)).fsPath);

		await project.changeTargetPlatform(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure)!);
		uri = project.getSystemDacpacUri(constants.masterDacpac);
		ssdtUri = project.getSystemDacpacSsdtUri(constants.masterDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', 'AzureV12', constants.masterDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', 'AzureV12', 'SqlSchemas', constants.masterDacpac)).fsPath);

		await project.changeTargetPlatform(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlDW)!);
		uri = project.getSystemDacpacUri(constants.masterDacpac);
		ssdtUri = project.getSystemDacpacSsdtUri(constants.masterDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', 'AzureDw', constants.masterDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', 'AzureDw', 'SqlSchemas', constants.masterDacpac)).fsPath);
	});


	it('Should update system dacpac paths in sqlproj when target platform is changed', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);
		await project.addSystemDatabaseReference({
			systemDb: SystemDatabase.master,
			suppressMissingDependenciesErrors: false
		});

		let projFileText = await fs.readFile(projFilePath);

		should.equal(project.databaseReferences.length, 1, 'System db reference should have been added');
		should(projFileText.includes(convertSlashesForSqlProj(Uri.file(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', '150', constants.masterDacpac)).fsPath.substring(1)))).be.true('System db reference path should be 150');
		should(projFileText.includes(convertSlashesForSqlProj(Uri.file(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', '150', 'SqlSchemas', constants.masterDacpac)).fsPath.substring(1)))).be.true('System db SSDT reference path should be 150');

		await project.changeTargetPlatform(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2016)!);
		projFileText = await fs.readFile(projFilePath);
		should(projFileText.includes(convertSlashesForSqlProj(Uri.file(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', '130', constants.masterDacpac)).fsPath.substring(1)))).be.true('System db reference path should have been updated to 130');
		should(projFileText.includes(convertSlashesForSqlProj(Uri.file(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', '130', 'SqlSchemas', constants.masterDacpac)).fsPath.substring(1)))).be.true('System db SSDT reference path should be 130');

		await project.changeTargetPlatform(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure)!);
		projFileText = await fs.readFile(projFilePath);
		should(projFileText.includes(convertSlashesForSqlProj(Uri.file(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', 'AzureV12', constants.masterDacpac)).fsPath.substring(1)))).be.true('System db reference path should have been updated to AzureV12');
		should(projFileText.includes(convertSlashesForSqlProj(Uri.file(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', 'AzureV12', 'SqlSchemas', constants.masterDacpac)).fsPath.substring(1)))).be.true('System db SSDT reference path should be AzureV12');

		await project.changeTargetPlatform(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlDW)!);
		projFileText = await fs.readFile(projFilePath);
		should(projFileText.includes(convertSlashesForSqlProj(Uri.file(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', 'AzureDw', constants.masterDacpac)).fsPath.substring(1)))).be.true('System db reference path should have been updated to AzureDw');
		should(projFileText.includes(convertSlashesForSqlProj(Uri.file(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', 'AzureDw', 'SqlSchemas', constants.masterDacpac)).fsPath.substring(1)))).be.true('System db SSDT reference path should be AzureDw');
	});

	it('Should choose correct msdb dacpac', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		let uri = project.getSystemDacpacUri(constants.msdbDacpac);
		let ssdtUri = project.getSystemDacpacSsdtUri(constants.msdbDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', '150', constants.msdbDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', '150', 'SqlSchemas', constants.msdbDacpac)).fsPath);

		await project.changeTargetPlatform(constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlServer2016)!);
		uri = project.getSystemDacpacUri(constants.msdbDacpac);
		ssdtUri = project.getSystemDacpacSsdtUri(constants.msdbDacpac);
		should.equal(uri.fsPath, Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', '130', constants.msdbDacpac)).fsPath);
		should.equal(ssdtUri.fsPath, Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', '130', 'SqlSchemas', constants.msdbDacpac)).fsPath);
	});

	it('Should throw error when choosing correct master dacpac if invalid DSP', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		await project.changeTargetPlatform('invalidPlatform');
		await testUtils.shouldThrowSpecificError(() => project.getSystemDacpacUri(constants.masterDacpac), constants.invalidDataSchemaProvider);
	});

	it('Should add system database references correctly', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		await project.addSystemDatabaseReference({ databaseName: 'master', systemDb: SystemDatabase.master, suppressMissingDependenciesErrors: false });
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to master');
		should(project.databaseReferences[0].databaseName).equal(constants.master, 'The database reference should be master');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		// make sure reference to ADS master dacpac and SSDT master dacpac was added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql(convertSlashesForSqlProj(project.getSystemDacpacUri(constants.master).fsPath.substring(1)));
		should(projFileText).containEql(convertSlashesForSqlProj(project.getSystemDacpacSsdtUri(constants.master).fsPath.substring(1)));

		await project.addSystemDatabaseReference({ databaseName: 'msdb', systemDb: SystemDatabase.msdb, suppressMissingDependenciesErrors: false });
		should(project.databaseReferences.length).equal(2, 'There should be two database references after adding a reference to msdb');
		should(project.databaseReferences[1].databaseName).equal(constants.msdb, 'The database reference should be msdb');
		should(project.databaseReferences[1].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[1].suppressMissingDependenciesErrors should be false');
		// make sure reference to ADS msdb dacpac and SSDT msdb dacpac was added
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql(convertSlashesForSqlProj(project.getSystemDacpacUri(constants.msdb).fsPath.substring(1)));
		should(projFileText).containEql(convertSlashesForSqlProj(project.getSystemDacpacSsdtUri(constants.msdb).fsPath.substring(1)));
	});

	it('Should add a dacpac reference to the same database correctly', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		// add database reference in the same database
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		await project.addDatabaseReference({ dacpacFileLocation: Uri.file('test1.dacpac'), suppressMissingDependenciesErrors: true });
		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to test1');
		should(project.databaseReferences[0].databaseName).equal('test1', 'The database reference should be test1');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(true, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be true');
		// make sure reference to test.dacpac was added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql('test1.dacpac');
	});

	it('Should add a dacpac reference to a different database in the same server correctly', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		// add database reference to a different database on the same server
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		await project.addDatabaseReference({
			dacpacFileLocation: Uri.file('test2.dacpac'),
			databaseName: 'test2DbName',
			databaseVariable: 'test2Db',
			suppressMissingDependenciesErrors: false
		});
		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to test2');
		should(project.databaseReferences[0].databaseName).equal('test2', 'The database reference should be test2');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		// make sure reference to test2.dacpac and SQLCMD variable was added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql('test2.dacpac');
		should(projFileText).containEql('<DatabaseSqlCmdVariable>test2Db</DatabaseSqlCmdVariable>');
		should(projFileText).containEql('<SqlCmdVariable Include="test2Db">');
		should(projFileText).containEql('<DefaultValue>test2DbName</DefaultValue>');
	});

	it('Should add a dacpac reference to a different database in a different server correctly', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		// add database reference to a different database on a different server
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		await project.addDatabaseReference({
			dacpacFileLocation: Uri.file('test3.dacpac'),
			databaseName: 'test3DbName',
			databaseVariable: 'test3Db',
			serverName: 'otherServerName',
			serverVariable: 'otherServer',
			suppressMissingDependenciesErrors: false
		});
		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to test3');
		should(project.databaseReferences[0].databaseName).equal('test3', 'The database reference should be test3');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		// make sure reference to test3.dacpac and SQLCMD variables were added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql('test3.dacpac');
		should(projFileText).containEql('<DatabaseSqlCmdVariable>test3Db</DatabaseSqlCmdVariable>');
		should(projFileText).containEql('<SqlCmdVariable Include="test3Db">');
		should(projFileText).containEql('<DefaultValue>test3DbName</DefaultValue>');
		should(projFileText).containEql('<ServerSqlCmdVariable>otherServer</ServerSqlCmdVariable>');
		should(projFileText).containEql('<SqlCmdVariable Include="otherServer">');
		should(projFileText).containEql('<DefaultValue>otherServerName</DefaultValue>');
	});

	it('Should add a project reference to the same database correctly', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		// add database reference to a different database on a different server
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		should(Object.keys(project.sqlCmdVariables).length).equal(0, `There should be no sqlcmd variables to start with. Actual: ${Object.keys(project.sqlCmdVariables).length}`);
		await project.addProjectReference({
			projectName: 'project1',
			projectGuid: '',
			projectRelativePath: Uri.file(path.join('..','project1', 'project1.sqlproj')),
			suppressMissingDependenciesErrors: false
		});
		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to project1');
		should(project.databaseReferences[0].databaseName).equal('project1', 'The database reference should be project1');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		should(Object.keys(project.sqlCmdVariables).length).equal(0, `There should be no sqlcmd variables added. Actual: ${Object.keys(project.sqlCmdVariables).length}`);

		// make sure reference to project1 and SQLCMD variables were added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql('project1');
	});

	it('Should add a project reference to a different database in the same server correctly', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		// add database reference to a different database on a different server
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		should(Object.keys(project.sqlCmdVariables).length).equal(0, 'There should be no sqlcmd variables to start with');
		await project.addProjectReference({
			projectName: 'project1',
			projectGuid: '',
			projectRelativePath: Uri.file(path.join('..','project1', 'project1.sqlproj')),
			databaseName: 'testdbName',
			databaseVariable: 'testdb',
			suppressMissingDependenciesErrors: false
		});
		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to project1');
		should(project.databaseReferences[0].databaseName).equal('project1', 'The database reference should be project1');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		should(Object.keys(project.sqlCmdVariables).length).equal(1, `There should be one new sqlcmd variable added. Actual: ${Object.keys(project.sqlCmdVariables).length}`);

		// make sure reference to project1 and SQLCMD variables were added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql('project1');
		should(projFileText).containEql('<DatabaseSqlCmdVariable>testdb</DatabaseSqlCmdVariable>');
		should(projFileText).containEql('<SqlCmdVariable Include="testdb">');
		should(projFileText).containEql('<DefaultValue>testdbName</DefaultValue>');
	});

	it('Should add a project reference to a different database in a different server correctly', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		// add database reference to a different database on a different server
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		should(Object.keys(project.sqlCmdVariables).length).equal(0, 'There should be no sqlcmd variables to start with');
		await project.addProjectReference({
			projectName: 'project1',
			projectGuid: '',
			projectRelativePath: Uri.file(path.join('..','project1', 'project1.sqlproj')),
			databaseName: 'testdbName',
			databaseVariable: 'testdb',
			serverName: 'otherServerName',
			serverVariable: 'otherServer',
			suppressMissingDependenciesErrors: false
		});
		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to project1');
		should(project.databaseReferences[0].databaseName).equal('project1', 'The database reference should be project1');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		should(Object.keys(project.sqlCmdVariables).length).equal(2, `There should be two new sqlcmd variables added. Actual: ${Object.keys(project.sqlCmdVariables).length}`);

		// make sure reference to project1 and SQLCMD variables were added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql('project1');
		should(projFileText).containEql('<DatabaseSqlCmdVariable>testdb</DatabaseSqlCmdVariable>');
		should(projFileText).containEql('<SqlCmdVariable Include="testdb">');
		should(projFileText).containEql('<DefaultValue>testdbName</DefaultValue>');
		should(projFileText).containEql('<ServerSqlCmdVariable>otherServer</ServerSqlCmdVariable>');
		should(projFileText).containEql('<SqlCmdVariable Include="otherServer">');
		should(projFileText).containEql('<DefaultValue>otherServerName</DefaultValue>');
	});

	it('Should not allow adding duplicate dacpac references', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');

		const dacpacReference: IDacpacReferenceSettings = { dacpacFileLocation: Uri.file('test.dacpac'), suppressMissingDependenciesErrors: false };
		await project.addDatabaseReference(dacpacReference);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to test.dacpac');
		should(project.databaseReferences[0].databaseName).equal('test', 'project.databaseReferences[0].databaseName should be test');

		// try to add reference to test.dacpac again
		await testUtils.shouldThrowSpecificError(async () => await project.addDatabaseReference(dacpacReference), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after trying to add a reference to test.dacpac again');
	});

	it('Should not allow adding duplicate system database references', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');

		const systemDbReference: ISystemDatabaseReferenceSettings = { databaseName: 'master', systemDb: SystemDatabase.master, suppressMissingDependenciesErrors: false };
		await project.addSystemDatabaseReference(systemDbReference);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to master');
		should(project.databaseReferences[0].databaseName).equal(constants.master, 'project.databaseReferences[0].databaseName should be master');

		// try to add reference to master again
		await testUtils.shouldThrowSpecificError(async () => await project.addSystemDatabaseReference(systemDbReference), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(1, 'There should only be one database reference after trying to add a reference to master again');
	});

	it('Should not allow adding duplicate project references', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');

		const projectReference: IProjectReferenceSettings = {
			projectName: 'testProject',
			projectGuid: '',
			projectRelativePath: Uri.file('testProject.sqlproj'),
			suppressMissingDependenciesErrors: false
		};
		await project.addProjectReference(projectReference);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to testProject.sqlproj');
		should(project.databaseReferences[0].databaseName).equal('testProject', 'project.databaseReferences[0].databaseName should be testProject');

		// try to add reference to testProject again
		await testUtils.shouldThrowSpecificError(async () => await project.addProjectReference(projectReference), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after trying to add a reference to testProject again');
	});

	it('Should handle trying to add duplicate database references when slashes are different direction', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');

		const projectReference: IProjectReferenceSettings = {
			projectName: 'testProject',
			projectGuid: '',
			projectRelativePath: Uri.file('testFolder/testProject.sqlproj'),
			suppressMissingDependenciesErrors: false
		};
		await project.addProjectReference(projectReference);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to testProject.sqlproj');
		should(project.databaseReferences[0].databaseName).equal('testProject', 'project.databaseReferences[0].databaseName should be testProject');

		// try to add reference to testProject again with slashes in the other direction
		projectReference.projectRelativePath = Uri.file('testFolder\\testProject.sqlproj');
		await testUtils.shouldThrowSpecificError(async () => await project.addProjectReference(projectReference), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after trying to add a reference to testProject again');
	});

	it('Should update sqlcmd variable values if value changes', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);
		const databaseVariable = 'test3Db';
		const serverVariable = 'otherServer';

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		await project.addDatabaseReference({
			dacpacFileLocation: Uri.file('test3.dacpac'),
			databaseName: 'test3DbName',
			databaseVariable: databaseVariable,
			serverName: 'otherServerName',
			serverVariable: serverVariable,
			suppressMissingDependenciesErrors: false
		});
		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to test3');
		should(project.databaseReferences[0].databaseName).equal('test3', 'The database reference should be test3');
		should(Object.keys(project.sqlCmdVariables).length).equal(2, 'There should be 2 sqlcmdvars after adding the dacpac reference');

		// make sure reference to test3.dacpac and SQLCMD variables were added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql('<SqlCmdVariable Include="test3Db">');
		should(projFileText).containEql('<DefaultValue>test3DbName</DefaultValue>');
		should(projFileText).containEql('<SqlCmdVariable Include="otherServer">');
		should(projFileText).containEql('<DefaultValue>otherServerName</DefaultValue>');

		// delete reference
		await project.deleteDatabaseReference(project.databaseReferences[0]);
		should(project.databaseReferences.length).equal(0, 'There should be no database references after deleting');
		should(Object.keys(project.sqlCmdVariables).length).equal(2, 'There should still be 2 sqlcmdvars after deleting the dacpac reference');

		// add reference to the same dacpac again but with different values for the sqlcmd variables
		await project.addDatabaseReference({
			dacpacFileLocation: Uri.file('test3.dacpac'),
			databaseName: 'newDbName',
			databaseVariable: databaseVariable,
			serverName: 'newServerName',
			serverVariable: serverVariable,
			suppressMissingDependenciesErrors: false
		});
		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to test3');
		should(project.databaseReferences[0].databaseName).equal('test3', 'The database reference should be test3');
		should(Object.keys(project.sqlCmdVariables).length).equal(2, 'There should still be 2 sqlcmdvars after adding the dacpac reference again with different sqlcmdvar values');

		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql('<SqlCmdVariable Include="test3Db">');
		should(projFileText).containEql('<DefaultValue>newDbName</DefaultValue>');
		should(projFileText).containEql('<SqlCmdVariable Include="otherServer">');
		should(projFileText).containEql('<DefaultValue>newServerName</DefaultValue>');
	});

	it('Should add pre and post deployment scripts as entries to sqlproj', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project: Project = await Project.openProject(projFilePath);

		const folderPath = 'Pre-Post Deployment Scripts';
		const preDeploymentScriptFilePath = path.join(folderPath, 'Script.PreDeployment1.sql');
		const postDeploymentScriptFilePath = path.join(folderPath, 'Script.PostDeployment1.sql');
		const fileContents = ' ';

		await project.addFolderItem(folderPath);
		await project.addScriptItem(preDeploymentScriptFilePath, fileContents, ItemType.preDeployScript);
		await project.addScriptItem(postDeploymentScriptFilePath, fileContents, ItemType.postDeployScript);

		const newProject = await Project.openProject(projFilePath);

		should(newProject.preDeployScripts.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(preDeploymentScriptFilePath))).not.equal(undefined, 'File Script.PreDeployment1.sql not read');
		should(newProject.postDeployScripts.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(postDeploymentScriptFilePath))).not.equal(undefined, 'File Script.PostDeployment1.sql not read');
	});

	it('Should show information messages when adding more than one pre/post deployment scripts to sqlproj', async function (): Promise<void> {
		const stub = sinon.stub(window, 'showInformationMessage').returns(<any>Promise.resolve());

		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project: Project = await Project.openProject(projFilePath);

		const folderPath = 'Pre-Post Deployment Scripts';
		const preDeploymentScriptFilePath = path.join(folderPath, 'Script.PreDeployment1.sql');
		const postDeploymentScriptFilePath = path.join(folderPath, 'Script.PostDeployment1.sql');
		const preDeploymentScriptFilePath2 = path.join(folderPath, 'Script.PreDeployment2.sql');
		const postDeploymentScriptFilePath2 = path.join(folderPath, 'Script.PostDeployment2.sql');
		const fileContents = ' ';

		await project.addFolderItem(folderPath);
		await project.addScriptItem(preDeploymentScriptFilePath, fileContents, ItemType.preDeployScript);
		await project.addScriptItem(postDeploymentScriptFilePath, fileContents, ItemType.postDeployScript);

		await project.addScriptItem(preDeploymentScriptFilePath2, fileContents, ItemType.preDeployScript);
		should(stub.calledWith(constants.deployScriptExists(constants.PreDeploy))).be.true(`showInformationMessage not called with expected message '${constants.deployScriptExists(constants.PreDeploy)}' Actual '${stub.getCall(0).args[0]}'`);

		await project.addScriptItem(postDeploymentScriptFilePath2, fileContents, ItemType.postDeployScript);
		should(stub.calledWith(constants.deployScriptExists(constants.PostDeploy))).be.true(`showInformationMessage not called with expected message '${constants.deployScriptExists(constants.PostDeploy)}' Actual '${stub.getCall(0).args[0]}'`);

		const newProject = await Project.openProject(projFilePath);

		should(newProject.preDeployScripts.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(preDeploymentScriptFilePath))).not.equal(undefined, 'File Script.PreDeployment1.sql not read');
		should(newProject.postDeployScripts.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(postDeploymentScriptFilePath))).not.equal(undefined, 'File Script.PostDeployment1.sql not read');
		should(newProject.noneDeployScripts.length).equal(2);
		should(newProject.noneDeployScripts.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(preDeploymentScriptFilePath2))).not.equal(undefined, 'File Script.PreDeployment2.sql not read');
		should(newProject.noneDeployScripts.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(postDeploymentScriptFilePath2))).not.equal(undefined, 'File Script.PostDeployment2.sql not read');

	});

	it('Should ignore duplicate file/folder entries in new sqlproj', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project: Project = await Project.openProject(projFilePath);
		const fileList = await testUtils.createListOfFiles(path.dirname(projFilePath));

		// 1. Add a folder to the project
		const existingFolderUri = fileList[2];
		const folderStats =  await fs.stat(existingFolderUri.fsPath);
		should(folderStats.isDirectory()).equal(true, 'Third entry in fileList should be a subfolder');

		const folderEntry = await project.addToProject([existingFolderUri]);
		should(project.files.length).equal(1, 'New folder entry should be added to the project');

		// Add the folder to the project again
		should(await project.addToProject([existingFolderUri]))
			.equal(folderEntry, 'Original folder entry should be returned when adding same folder for a second time');
		should(project.files.length).equal(1, 'No new entries should be added to the project when adding same folder for a second time');

		// 2. Add a file to the project
		let existingFileUri = fileList[1];
		let fileStats = await fs.stat(existingFileUri.fsPath);
		should(fileStats.isFile()).equal(true, 'Second entry in fileList should be a file');

		let fileEntry = await project.addToProject([existingFileUri]);
		should(project.files.length).equal(2, 'New file entry should be added to the project');

		// Add the file to the project again
		should(await project.addToProject([existingFileUri]))
			.equal(fileEntry, 'Original file entry should be returned when adding same file for a second time');
		should(project.files.length).equal(2, 'No new entries should be added to the project when adding same file for a second time');

		// 3. Add a file from subfolder to the project
		existingFileUri = fileList[3];
		fileStats = await fs.stat(existingFileUri.fsPath);
		should(fileStats.isFile()).equal(true, 'Fourth entry in fileList should be a file');

		fileEntry = await project.addToProject([existingFileUri]);
		should(project.files.length).equal(3, 'New file entry should be added to the project');

		// Add the file from subfolder to the project again
		should(await project.addToProject([existingFileUri]))
			.equal(fileEntry, 'Original file entry should be returned when adding same file for a second time');
		should(project.files.length).equal(3, 'No new entries should be added to the project when adding same file for a second time');
	});

	it('Should ignore duplicate file entries in existing sqlproj', async function (): Promise<void> {
		// Create new sqlproj
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const fileList = await testUtils.createListOfFiles(path.dirname(projFilePath));

		let project: Project = await Project.openProject(projFilePath);

		// Add a file to the project
		let existingFileUri = fileList[3];
		let fileStats = await fs.stat(existingFileUri.fsPath);
		should(fileStats.isFile()).equal(true, 'Fourth entry in fileList should be a file');
		await project.addToProject([existingFileUri]);

		// Reopen existing project
		project = await Project.openProject(projFilePath);

		// Try adding the same file to the project again
		await project.addToProject([existingFileUri]);
	});

	it('Should not overwrite existing files', async function (): Promise<void> {
		// Create new sqlproj
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const fileList = await testUtils.createListOfFiles(path.dirname(projFilePath));

		let project: Project = await Project.openProject(projFilePath);

		// Add a file entry to the project with explicit content
		let existingFileUri = fileList[3];
		let fileStats = await fs.stat(existingFileUri.fsPath);
		should(fileStats.isFile()).equal(true, 'Fourth entry in fileList should be a file');

		const relativePath = path.relative(path.dirname(projFilePath), existingFileUri.fsPath);
		await testUtils.shouldThrowSpecificError(
			async () => await project.addScriptItem(relativePath, 'Hello World!'),
			`A file with the name '${path.parse(relativePath).name}' already exists on disk at this location. Please choose another name.`);
	});

	it('Should not add folders outside of the project folder', async function (): Promise<void> {
		// Create new sqlproj
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);

		let project: Project = await Project.openProject(projFilePath);

		// Try adding project root folder itself - this is silently ignored
		await project.addToProject([Uri.file(path.dirname(projFilePath))]);
		should.equal(project.files.length, 0, 'Nothing should be added to the project');

		// Try adding a parent of the project folder
		await testUtils.shouldThrowSpecificError(
			async () => await project.addToProject([Uri.file(path.dirname(path.dirname(projFilePath)))]),
			'Items with absolute path outside project folder are not supported. Please make sure the paths in the project file are relative to project folder.',
			'Folders outside the project folder should not be added.');
	});

	it('Project entry relative path should not change after reload', async function (): Promise<void> {
		// Create new sqlproj
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const projectFolder = path.dirname(projFilePath);

		// Create file under nested folders structure
		const newFile = path.join(projectFolder, 'foo', 'test.sql');
		await fs.mkdir(path.dirname(newFile), { recursive: true });
		await fs.writeFile(newFile, '');

		let project: Project = await Project.openProject(projFilePath);

		// Add a file to the project
		await project.addToProject([Uri.file(newFile)]);

		// Store the original `relativePath` of the project entry
		let fileEntry = project.files.find(f => f.relativePath.endsWith('test.sql'));

		should.exist(fileEntry, 'Entry for the file should be added to project');
		let originalRelativePath = '';
		if (fileEntry) {
			originalRelativePath = fileEntry.relativePath;
		}

		// Reopen existing project
		project = await Project.openProject(projFilePath);

		// Validate that relative path of the file entry matches the original
		// There will be additional folder
		should(project.files.length).equal(2, 'Two entries are expected in the loaded project');

		fileEntry = project.files.find(f => f.relativePath.endsWith('test.sql'));
		should.exist(fileEntry, 'Entry for the file should be present in the project after reload');
		if (fileEntry) {
			should(fileEntry.relativePath).equal(originalRelativePath, 'Relative path should match after reload');
		}
	});

	it('Intermediate folders for file should be automatically added to project', async function (): Promise<void> {
		// Create new sqlproj
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const projectFolder = path.dirname(projFilePath);

		// Create file under nested folders structure
		const newFile = path.join(projectFolder, 'foo', 'bar', 'test.sql');
		await fs.mkdir(path.dirname(newFile), { recursive: true });
		await fs.writeFile(newFile, '');

		// Open empty project
		let project: Project = await Project.openProject(projFilePath);

		// Add a file to the project
		await project.addToProject([Uri.file(newFile)]);

		// Validate that intermediate folders were added to the project
		should(project.files.length).equal(3, 'Three entries are expected in the project');
		should(project.files.map(f => ({ type: f.type, relativePath: f.relativePath })))
			.containDeep([
				{ type: EntryType.Folder, relativePath: 'foo\\' },
				{ type: EntryType.Folder, relativePath: 'foo\\bar\\' },
				{ type: EntryType.File, relativePath: 'foo\\bar\\test.sql' }]);
	});

	it('Intermediate folders for folder should be automatically added to project', async function (): Promise<void> {
		// Create new sqlproj
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const projectFolder = path.dirname(projFilePath);

		// Create nested folders structure
		const newFolder = path.join(projectFolder, 'foo', 'bar');
		await fs.mkdir(newFolder, { recursive: true });

		// Open empty project
		let project: Project = await Project.openProject(projFilePath);

		// Add a file to the project
		await project.addToProject([Uri.file(newFolder)]);

		// Validate that intermediate folders were added to the project
		should(project.files.length).equal(2, 'Two entries are expected in the project');
		should(project.files.map(f => ({ type: f.type, relativePath: f.relativePath })))
			.containDeep([
				{ type: EntryType.Folder, relativePath: 'foo\\' },
				{ type: EntryType.Folder, relativePath: 'foo\\bar\\' }]);
	});

	it('Should not add duplicate intermediate folders to project', async function (): Promise<void> {
		// Create new sqlproj
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const projectFolder = path.dirname(projFilePath);

		// Create file under nested folders structure
		const newFile = path.join(projectFolder, 'foo', 'bar', 'test.sql');
		await fs.mkdir(path.dirname(newFile), { recursive: true });
		await fs.writeFile(newFile, '');

		const anotherNewFile = path.join(projectFolder, 'foo', 'bar', 'test2.sql');
		await fs.writeFile(anotherNewFile, '');

		// Open empty project
		let project: Project = await Project.openProject(projFilePath);

		// Add a file to the project
		await project.addToProject([Uri.file(newFile)]);
		await project.addToProject([Uri.file(anotherNewFile)]);

		// Validate that intermediate folders were added to the project
		should(project.files.length).equal(4, 'Four entries are expected in the project');
		should(project.files.map(f => ({ type: f.type, relativePath: f.relativePath })))
			.containDeep([
				{ type: EntryType.Folder, relativePath: 'foo\\' },
				{ type: EntryType.Folder, relativePath: 'foo\\bar\\' },
				{ type: EntryType.File, relativePath: 'foo\\bar\\test.sql' },
				{ type: EntryType.File, relativePath: 'foo\\bar\\test2.sql' }]);
	});

	it('Should not add duplicate intermediate folders to project when folder is explicitly added', async function (): Promise<void> {
		// Create new sqlproj
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const projectFolder = path.dirname(projFilePath);

		// Create file under nested folders structure
		const newFile = path.join(projectFolder, 'foo', 'bar', 'test.sql');
		await fs.mkdir(path.dirname(newFile), { recursive: true });
		await fs.writeFile(newFile, '');

		const explicitIntermediateFolder = path.join(projectFolder, 'foo', 'bar');
		await fs.mkdir(explicitIntermediateFolder, { recursive: true });

		// Open empty project
		let project: Project = await Project.openProject(projFilePath);

		// Add file and folder to the project
		await project.addToProject([Uri.file(newFile), Uri.file(explicitIntermediateFolder)]);

		// Validate that intermediate folders were added to the project
		should(project.files.length).equal(3, 'Three entries are expected in the project');
		should(project.files.map(f => ({ type: f.type, relativePath: f.relativePath })))
			.containDeep([
				{ type: EntryType.Folder, relativePath: 'foo\\' },
				{ type: EntryType.Folder, relativePath: 'foo\\bar\\' },
				{ type: EntryType.File, relativePath: 'foo\\bar\\test.sql' }]);
	});

	it('Should handle adding existing items to project', async function (): Promise<void> {
		// Create new sqlproj
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const projectFolder = path.dirname(projFilePath);

		// Create 2 new files, a sql file and a txt file
		const sqlFile = path.join(projectFolder, 'test.sql');
		const txtFile = path.join(projectFolder, 'foo', 'test.txt');
		await fs.writeFile(sqlFile, '');
		await fs.mkdir(path.dirname(txtFile));
		await fs.writeFile(txtFile, '');

		const project: Project = await Project.openProject(projFilePath);

		// Add them as existing files
		await project.addExistingItem(sqlFile);
		await project.addExistingItem(txtFile);

		// Validate files should have been added to project
		should(project.files.length).equal(3, 'Three entries are expected in the project');
		should(project.files.map(f => ({ type: f.type, relativePath: f.relativePath })))
			.containDeep([
				{ type: EntryType.Folder, relativePath: 'foo\\' },
				{ type: EntryType.File, relativePath: 'test.sql' },
				{ type: EntryType.File, relativePath: 'foo\\test.txt' }]);

		// Validate project file XML
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Build Include="test.sql" />')).equal(true, projFileText);
		should(projFileText.includes('<None Include="foo\\test.txt" />')).equal(true, projFileText);
	});
});

describe('Project: sdk style project content operations', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	beforeEach(function (): void {
		sinon.restore();
	});

	it('Should read project from sqlproj and files and folders by globbing', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectBaseline);
		await testUtils.createDummyFileStructureWithPrePostDeployScripts(false, undefined, path.dirname(projFilePath));
		const project: Project = await Project.openProject(projFilePath);

		// Files and folders
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(3);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(13);

		// SqlCmdVariables
		should(Object.keys(project.sqlCmdVariables).length).equal(2);
		should(project.sqlCmdVariables['ProdDatabaseName']).equal('MyProdDatabase');
		should(project.sqlCmdVariables['BackupDatabaseName']).equal('MyBackupDatabase');

		// Database references
		// should only have one database reference even though there are two master.dacpac references (1 for ADS and 1 for SSDT)
		should(project.databaseReferences.length).equal(1);
		should(project.databaseReferences[0].databaseName).containEql(constants.master);
		should(project.databaseReferences[0] instanceof SystemDatabaseReferenceProjectEntry).equal(true);

		// // Pre-post deployment scripts
		should(project.preDeployScripts.length).equal(1);
		should(project.postDeployScripts.length).equal(1);
		should(project.noneDeployScripts.length).equal(2);
		should(project.preDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Script.PreDeployment1.sql')).not.equal(undefined, 'File Script.PreDeployment1.sql not read');
		should(project.noneDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Script.PreDeployment2.sql')).not.equal(undefined, 'File Script.PreDeployment2.sql not read');
		should(project.postDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'Script.PostDeployment1.sql')).not.equal(undefined, 'File Script.PostDeployment1.sql not read');
		should(project.noneDeployScripts.find(f => f.type === EntryType.File && f.relativePath === 'folder1\\Script.PostDeployment2.sql')).not.equal(undefined, 'File folder1\\Script.PostDeployment2.sql not read');
	});

	it('Should handle files listed in sqlproj', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectWithFilesSpecifiedBaseline);
		await testUtils.createDummyFileStructure(false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);

		// Files and folders
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(2);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);

		// these are also listed in the sqlproj, but there shouldn't be duplicate entries for them
		should(project.files.filter(f => f.relativePath === 'folder1\\file2.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === 'file1.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === 'folder1\\').length).equal(1);
	});

	it('Should handle pre/post/none deploy scripts outside of project folder', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		const mainProjectPath =  path.join(testFolderPath, 'project');
		const otherFolderPath = path.join(testFolderPath, 'other');
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectWithGlobsSpecifiedBaseline, mainProjectPath);
		await testUtils.createDummyFileStructure(false, undefined, path.dirname(projFilePath));

		// create files outside of project folder that are included in the project file
		await fs.mkdir(otherFolderPath);
		await testUtils.createOtherDummyFiles(otherFolderPath);

		const project: Project = await Project.openProject(projFilePath);

		// verify files, folders, pre/post/none deploy scripts were loaded correctly
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(2);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(18);
		should(project.preDeployScripts.length).equal(1);
		should(project.postDeployScripts.length).equal(1);
		should(project.noneDeployScripts.length).equal(1);
	});

	it('Should handle globbing patterns listed in sqlproj', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		const mainProjectPath =  path.join(testFolderPath, 'project');
		const otherFolderPath = path.join(testFolderPath, 'other');
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectWithGlobsSpecifiedBaseline, mainProjectPath);
		await testUtils.createDummyFileStructure(false, undefined, path.dirname(projFilePath));

		// create files outside of project folder that are included in the project file
		await fs.mkdir(otherFolderPath);
		await testUtils.createOtherDummyFiles(otherFolderPath);

		const project: Project = await Project.openProject(projFilePath);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(18);

		// make sure all the correct files from the globbing patterns were included
		// ..\other\folder1\test?.sql
		should(project.files.filter(f => f.relativePath === '..\\other\\folder1\\test1.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === '..\\other\\folder1\\test2.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === '..\\other\\folder1\\testLongerName.sql').length).equal(0);

		// ..\other\folder1\file*.sql
		should(project.files.filter(f => f.relativePath === '..\\other\\folder1\\file1.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === '..\\other\\folder1\\file2.sql').length).equal(1);

		// ..\other\folder2\*.sql
		should(project.files.filter(f => f.relativePath === '..\\other\\folder2\\file1.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === '..\\other\\folder2\\file2.sql').length).equal(1);

		// make sure no duplicates from folder1\*.sql
		should(project.files.filter(f => f.relativePath === 'folder1\\file1.sql').length).equal(1);
	});

	it('Should handle Build Remove in sqlproj', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		const mainProjectPath =  path.join(testFolderPath, 'project');
		const otherFolderPath = path.join(testFolderPath, 'other');
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectWithBuildRemoveBaseline, mainProjectPath);
		await testUtils.createDummyFileStructure(false, undefined, path.dirname(projFilePath));

		// create files outside of project folder that are included in the project file
		await fs.mkdir(otherFolderPath);
		await testUtils.createOtherDummyFiles(otherFolderPath);

		const project: Project = await Project.openProject(projFilePath);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(7);

		// make sure all the correct files from the globbing patterns were included and removed are evaluated in order

		// <Build Include="..\other\folder1\file*.sql" />
		// <Build Remove="..\other\folder1\file1.sql" />
		// expected: ..\other\folder1\file1.sql is not included
		should(project.files.filter(f => f.relativePath === '..\\other\\folder1\\file1.sql').length).equal(0);
		should(project.files.filter(f => f.relativePath === '..\\other\\folder1\\file2.sql').length).equal(1);

		// <Build Include="..\other\folder2\file2.sql" />
		// <Build Remove="..\other\folder2\**" />
		// expected: ..\other\folder2\file2.sql is not included
		should(project.files.filter(f => f.relativePath === '..\\other\\folder2\\file1.sql').length).equal(0);
		should(project.files.filter(f => f.relativePath === '..\\other\\folder2\\file2.sql').length).equal(0);

		// <Build Remove="folder1\*.sql" />
		// <Build Include="folder1\file2.sql" />
		// expected: folder1\file2.sql is included
		should(project.files.filter(f => f.relativePath === 'folder1\\file1.sql').length).equal(0);
		should(project.files.filter(f => f.relativePath === 'folder1\\file2.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === 'folder1\\file3.sql').length).equal(0);
		should(project.files.filter(f => f.relativePath === 'folder1\\file4.sql').length).equal(0);
		should(project.files.filter(f => f.relativePath === 'folder1\\file5.sql').length).equal(0);

		// <Build Remove="folder2\file3.sql" />
		// <Build Include="folder2\*.sql" />
		// expected: folder2\file3.sql is included
		should(project.files.filter(f => f.relativePath === 'folder2\\file1.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === 'folder2\\file2.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === 'folder2\\file3.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === 'folder2\\file4.sql').length).equal(1);
		should(project.files.filter(f => f.relativePath === 'folder2\\file5.sql').length).equal(1);

		// <Build Remove="file1.sql" />
		should(project.files.filter(f => f.relativePath === 'file1.sql').length).equal(0);
	});

	it('Should exclude pre/post/none deploy scripts correctly', async function (): Promise<void> {
		const folderPath = await testUtils.generateTestFolderPath();
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newSdkStyleProjectSdkNodeBaseline, folderPath);

		const project: Project = await Project.openProject(projFilePath);
		await project.addScriptItem('Script.PreDeployment1.sql', 'fake contents', ItemType.preDeployScript);
		await project.addScriptItem('Script.PreDeployment2.sql', 'fake contents', ItemType.preDeployScript);
		await project.addScriptItem('Script.PostDeployment1.sql', 'fake contents', ItemType.postDeployScript);

		// verify they were added to the sqlproj
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<PreDeploy Include="Script.PreDeployment1.sql" />')).equal(true);
		should(projFileText.includes('<None Include="Script.PreDeployment2.sql" />')).equal(true);
		should(projFileText.includes('<PostDeploy Include="Script.PostDeployment1.sql" />')).equal(true);
		should(project.preDeployScripts.length).equal(1, 'Script.PreDeployment1.sql should have been added');
		should(project.noneDeployScripts.length).equal(1, 'Script.PreDeployment2.sql should have been added');
		should(project.preDeployScripts.length).equal(1, 'Script.PostDeployment1.sql should have been added');
		should(project.files.length).equal(0, 'There should not be any files');

		// exclude the pre/post/none deploy script
		await project.exclude(project.preDeployScripts.find(f => f.relativePath === 'Script.PreDeployment1.sql')!);
		await project.exclude(project.noneDeployScripts.find(f => f.relativePath === 'Script.PreDeployment2.sql')!);
		await project.exclude(project.postDeployScripts.find(f => f.relativePath === 'Script.PostDeployment1.sql')!);

		// verify they are excluded in the sqlproj
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<PreDeploy Include="Script.PreDeployment1.sql" />')).equal(false);
		should(projFileText.includes('<None Include="Script.PreDeployment2.sql" />')).equal(false);
		should(projFileText.includes('<PostDeploy Include="Script.PostDeployment1.sql" />')).equal(false);
		should(projFileText.includes('<None Remove="Script.PreDeployment1.sql" />')).equal(true);
		should(projFileText.includes('<None Remove="Script.PreDeployment2.sql" />')).equal(true);
		should(projFileText.includes('<None Remove="Script.PostDeployment1.sql" />')).equal(true);

		should(project.preDeployScripts.length).equal(0, 'Script.PreDeployment1.sql should have been removed');
		should(project.noneDeployScripts.length).equal(0, 'Script.PreDeployment2.sql should have been removed');
		should(project.postDeployScripts.length).equal(0, 'Script.PostDeployment1.sql should have been removed');
		should(project.files.length).equal(0, 'There should not be any files after the excludes');
	});

	it('Should handle excluding files included by glob patterns', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		const mainProjectPath =  path.join(testFolderPath, 'project');
		const otherFolderPath = path.join(testFolderPath, 'other');
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectWithGlobsSpecifiedBaseline, mainProjectPath);
		await testUtils.createDummyFileStructure(false, undefined, path.dirname(projFilePath));

		// create files outside of project folder that are included in the project file
		await fs.mkdir(otherFolderPath);
		await testUtils.createOtherDummyFiles(otherFolderPath);

		const project: Project = await Project.openProject(projFilePath);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(18);

		// exclude a file in the project's folder
		should(project.files.filter(f => f.relativePath === 'folder1\\file1.sql').length).equal(1);
		await project.exclude(project.files.find(f => f.relativePath === 'folder1\\file1.sql')!);
		should(project.files.filter(f => f.relativePath === 'folder1\\file1.sql').length).equal(0);

		// exclude explicitly included file from an outside folder
		should(project.files.filter(f => f.relativePath === '..\\other\\file1.sql').length).equal(1);
		await project.exclude(project.files.find(f => f.relativePath === '..\\other\\file1.sql')!);
		should(project.files.filter(f => f.relativePath === '..\\other\\file1.sql').length).equal(0);

		// exclude glob included file from an outside folder
		should(project.files.filter(f => f.relativePath === '..\\other\\folder1\\test2.sql').length).equal(1);
		await project.exclude(project.files.find(f => f.relativePath === '..\\other\\folder1\\test2.sql')!);
		should(project.files.filter(f => f.relativePath === '..\\other\\folder1\\test2.sql').length).equal(0);

		// make sure a <Build Remove="folder\file1.sql"> was added
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Build Remove="folder1\\file1.sql" />')).equal(true, projFileText);

		// make sure  <Build Include="..\other\file1.sql"> was removed and no <Build Remove"..."> was added for it
		should(projFileText.includes('<Build Include="..\\other\\file1.sql" />')).equal(false, projFileText);
		should(projFileText.includes('<Build Remove="..\\other\\file1.sql" />')).equal(false, projFileText);

		// make sure a <Build Remove="..\other\folder1\test2.sql"> was added
		should(projFileText.includes('<Build Remove="..\\other\\folder1\\test2.sql" />')).equal(true, projFileText);
	});

	it('Should only add Build entries to sqlproj for files not included by project folder glob and external streaming jobs', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectBaseline);
		const project = await Project.openProject(projFilePath);

		const folderPath = 'Stored Procedures\\';
		const scriptPath = path.join(folderPath, 'Fake Stored Proc.sql');
		const scriptContents = 'SELECT \'This is not actually a stored procedure.\'';

		const scriptPathTagged = 'Fake External Streaming Job.sql';
		const scriptContentsTagged = 'EXEC sys.sp_create_streaming_job \'job\', \'SELECT 7\'';

		const outsideFolderScriptPath = path.join('..', 'Other Fake Stored Proc.sql');
		const outsideFolderScriptContents = 'SELECT \'This is also not actually a stored procedure.\'';

		const otherFolderPath = 'OtherFolder\\';

		await project.addScriptItem(scriptPath, scriptContents);
		await project.addScriptItem(scriptPathTagged, scriptContentsTagged, ItemType.externalStreamingJob);
		await project.addScriptItem(outsideFolderScriptPath, outsideFolderScriptContents);
		await project.addFolderItem(otherFolderPath);

		const newProject = await Project.openProject(projFilePath);

		should(newProject.files.find(f => f.type === EntryType.Folder && f.relativePath === convertSlashesForSqlProj(folderPath))).not.equal(undefined);
		should(newProject.files.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(scriptPath))).not.equal(undefined);
		should(newProject.files.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(scriptPathTagged))).not.equal(undefined);
		should(newProject.files.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(scriptPathTagged))?.sqlObjectType).equal(constants.ExternalStreamingJob);
		should(newProject.files.find(f => f.type === EntryType.File && f.relativePath === convertSlashesForSqlProj(outsideFolderScriptPath))).not.equal(undefined);

		should(newProject.files.find(f => f.type === EntryType.Folder && f.relativePath === convertSlashesForSqlProj(otherFolderPath))).not.equal(undefined);

		// only the external streaming job and file outside of the project folder should have been added to the sqlproj
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Folder Include="Stored Procedures" />')).equal(false, projFileText);
		should(projFileText.includes('<Build Include="Stored Procedures\\Fake Stored Proc.sql" />')).equal(false, projFileText);
		should(projFileText.includes('<Build Include="Fake External Streaming Job.sql" Type="ExternalStreamingJob" />')).equal(true, projFileText);
		should(projFileText.includes('<Build Include="..\\Other Fake Stored Proc.sql" />')).equal(true, projFileText);
		should(projFileText.includes('<Folder Include="OtherFolder" />')).equal(false, projFileText);
	});

	it('Should handle excluding glob included folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectBaseline, testFolderPath);
		await testUtils.createDummyFileStructureWithPrePostDeployScripts(false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(13);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(3);
		should(project.noneDeployScripts.length).equal(2);

		// try to exclude a glob included folder
		await project.exclude(project.files.find(f => f.relativePath === 'folder1\\')!);

		// verify folder and contents are excluded
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(1);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(6);
		should(project.noneDeployScripts.length).equal(1, 'Script.PostDeployment2.sql should have been excluded');
		should(project.files.find(f => f.relativePath === 'folder1\\')).equal(undefined);

		// verify sqlproj has glob exclude for folder, but not for files and inner folder
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Build Remove="folder1\\**" />')).equal(true, projFileText);
		should(projFileText.includes('<Build Remove="folder1\\file1.sql" />')).equal(false, projFileText);
		should(projFileText.includes('<Build Remove="folder1\\nestedFolder\\**" />')).equal(false, projFileText);
	});

	it('Should handle excluding nested glob included folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectBaseline, testFolderPath);
		await testUtils.createDummyFileStructureWithPrePostDeployScripts(false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(13);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(3);

		// try to exclude a glob included folder
		await project.exclude(project.files.find(f => f.relativePath === 'folder1\\nestedFolder\\')!);

		// verify folder and contents are excluded
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(2);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);
		should(project.files.find(f => f.relativePath === 'folder1\\nestedFolder\\')).equal(undefined);

		// verify sqlproj has glob exclude for folder, but not for files
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Build Remove="folder1\\nestedFolder\\**" />')).equal(true, projFileText);
		should(projFileText.includes('<Build Remove="folder1\\nestedFolder\\otherFile1.sql" />')).equal(false, projFileText);
	});

	it('Should handle excluding explicitly included folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectWithFilesSpecifiedBaseline, testFolderPath);
		await testUtils.createDummyFileStructure(false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(2);
		should(project.files.find(f => f.relativePath === 'folder1\\')!).not.equal(undefined);
		should(project.files.find(f => f.relativePath === 'folder2\\')!).not.equal(undefined);

		// try to exclude an explicitly included folder without trailing \ in sqlproj
		await project.exclude(project.files.find(f => f.relativePath === 'folder1\\')!);

		// verify folder and contents are excluded
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(1);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(6);
		should(project.files.find(f => f.relativePath === 'folder1\\')).equal(undefined);

		// try to exclude an explicitly included folder with trailing \ in sqlproj
		await project.exclude(project.files.find(f => f.relativePath === 'folder2\\')!);

		// verify folder and contents are excluded
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(0);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(1);
		should(project.files.find(f => f.relativePath === 'folder2\\')).equal(undefined);

		// make sure both folders are removed from sqlproj and remove entry is added
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Folder Include="folder1" />')).equal(false, projFileText);
		should(projFileText.includes('<Folder Include="folder2\\" />')).equal(false, projFileText);

		should(projFileText.includes('<Build Remove="folder1\\**" />')).equal(true, projFileText);
		should(projFileText.includes('<Build Remove="folder2\\**" />')).equal(true, projFileText);
	});

	it('Should handle adding empty folders and removing the Folder entry when the folder is no longer empty', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectWithFilesSpecifiedBaseline, testFolderPath);
		await testUtils.createDummyFileStructure(false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(2);
		should(project.files.find(f => f.relativePath === 'folder1\\')!).not.equal(undefined);
		should(project.files.find(f => f.relativePath === 'folder2\\')!).not.equal(undefined);

		// try to add a new folder
		await project.addFolderItem('folder3\\');

		// try to add a new folder without trailing backslash
		await project.addFolderItem('folder4');

		// verify folders were added
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(4);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);
		should(project.files.find(f => f.relativePath === 'folder3\\')).not.equal(undefined);
		should(project.files.find(f => f.relativePath === 'folder4\\')).not.equal(undefined);

		// verify folders were added and the entries have a backslash in the sqlproj
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Folder Include="folder3\\" />')).equal(true, projFileText);
		should(projFileText.includes('<Folder Include="folder4\\" />')).equal(true, projFileText);

		// add file to folder3
		await project.addScriptItem(path.join('folder3', 'test.sql'), 'fake contents');
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(4);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(12);
		should(project.files.find(f => f.relativePath === 'folder3\\test.sql')).not.equal(undefined);

		// verify folder3 entry is no longer in sqlproj
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Folder Include="folder3\\" />')).equal(false, projFileText);
		should(projFileText.includes('<Folder Include="folder4\\" />')).equal(true, projFileText);
	});

	it('Should handle adding nested empty folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectWithFilesSpecifiedBaseline, testFolderPath);
		await testUtils.createDummyFileStructure(false, undefined, path.dirname(projFilePath));

		let project: Project = await Project.openProject(projFilePath);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(2);
		should(project.files.find(f => f.relativePath === 'folder1\\')!).not.equal(undefined);
		should(project.files.find(f => f.relativePath === 'folder2\\')!).not.equal(undefined);

		// try to add a new folder
		await project.addFolderItem('folder3\\');

		// try to add a nested folder
		await project.addFolderItem('folder3\\innerFolder\\');

		// verify folders were added
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(4);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);
		should(project.files.find(f => f.relativePath === 'folder3\\')).not.equal(undefined);
		should(project.files.find(f => f.relativePath === 'folder3\\innerFolder\\')).not.equal(undefined);

		// verify there's only one folder entry for the two folders that were added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Folder Include="folder3\\" />')).equal(false, projFileText);
		should(projFileText.includes('<Folder Include="folder3\\innerFolder\\" />')).equal(true, projFileText);

		// load the project again and make sure both new folders get loaded
		project = await Project.openProject(projFilePath);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(11);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(4);
		should(project.files.find(f => f.relativePath === 'folder3\\')!).not.equal(undefined, 'folder3\\ should be loaded');
		should(project.files.find(f => f.relativePath === 'folder3\\innerFolder\\')!).not.equal(undefined, 'folder3\\innerFolder\\ should be loaded');

		// add file to folder3
		await project.addScriptItem(path.join('folder3', 'test.sql'), 'fake contents');
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(4);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(12);
		should(project.files.find(f => f.relativePath === 'folder3\\test.sql')).not.equal(undefined, 'folder3\\test.sql should be in the project files');

		// verify folder entry for innerFolder entry is still there
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Folder Include="folder3\\innerFolder\\" />')).equal(true, projFileText);

		// load the project again and make sure the folders still get loaded
		project = await Project.openProject(projFilePath);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(12);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(4);
		should(project.files.find(f => f.relativePath === 'folder3\\')!).not.equal(undefined, 'folder3\\ should be loaded');
		should(project.files.find(f => f.relativePath === 'folder3\\innerFolder\\')!).not.equal(undefined, 'folder3\\innerFolder\\ should be loaded');
	});

	it('Should handle deleting empty folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newSdkStyleProjectSdkNodeBaseline, testFolderPath);

		const project: Project = await Project.openProject(projFilePath);
		const beforeProjFileText = (await fs.readFile(projFilePath)).toString();

		should(project.files.filter(f => f.type === EntryType.File).length).equal(0);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(0);

		// add an empty folder
		await project.addFolderItem('folder1');

		// verify folder was added
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(1);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(0);
		should(project.files.find(f => f.relativePath === 'folder1\\')).not.equal(undefined, 'folder1 should have been added');

		// verify entry was added for the new empty folder in the sqlproj
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Folder Include="folder1\\" />')).equal(true, projFileText);

		// delete the empty folder
		await project.deleteFileFolder(project.files.find(f => f.relativePath === 'folder1\\')!);

		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(0, 'folder1 should have been deleted');

		// verify the folder entry was removed from the sqlproj and a Build Remove was not added
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.trimEnd() === beforeProjFileText.trimEnd()).equal(true, 'The sqlproj should not have changed after deleting folder1');
	});

	it('Should handle deleting not empty glob included folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectBaseline, testFolderPath);
		await testUtils.createDummyFileStructureWithPrePostDeployScripts(false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);
		const beforeProjFileText = (await fs.readFile(projFilePath)).toString();

		should(project.files.filter(f => f.type === EntryType.File).length).equal(13);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(3);

		// delete a folder with contents
		await project.deleteFileFolder(project.files.find(f => f.relativePath === 'folder2\\')!);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(8);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(2);

		// verify the folder entry was removed from the sqlproj and a Build Remove was not added
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.trimEnd() === beforeProjFileText.trimEnd()).equal(true, 'The sqlproj should not have changed after deleting folder2');
	});

	it('Should handle deleting explicitly included folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectWithFilesSpecifiedBaseline, testFolderPath);
		await testUtils.createDummyFileStructureWithPrePostDeployScripts(false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);

		should(project.files.filter(f => f.type === EntryType.File).length).equal(13);
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(3);
		should(project.files.find(f => f.relativePath === 'folder1\\')!).not.equal(undefined);
		should(project.files.find(f => f.relativePath === 'folder2\\')!).not.equal(undefined);

		// try to delete an explicitly included folder with the trailing \ in sqlproj
		await project.deleteFileFolder(project.files.find(f => f.relativePath === 'folder2\\')!);

		// verify the project not longer has folder2 and its contents
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(2);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(8);
		should(project.files.find(f => f.relativePath === 'folder2\\')).equal(undefined);

		// try to delete an explicitly included folder without trailing \ in sqlproj
		await project.deleteFileFolder(project.files.find(f => f.relativePath === 'folder1\\')!);

		// verify the project not longer has folder1 and its contents
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(0);
		should(project.files.filter(f => f.type === EntryType.File).length).equal(1);
		should(project.files.find(f => f.relativePath === 'folder1\\')).equal(undefined);

		// make sure both folders are removed from sqlproj and Build Remove entries were not added
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Folder Include="folder1" />')).equal(false, projFileText);
		should(projFileText.includes('<Folder Include="folder2\\" />')).equal(false, projFileText);

		should(projFileText.includes('<Build Remove="folder1\\**" />')).equal(false, projFileText);
		should(projFileText.includes('<Build Remove="folder2\\**" />')).equal(false, projFileText);
	});

	it('Should add a project guid if there is not one in the sqlproj', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectNoProjectGuidBaseline);
		let projFileText = (await fs.readFile(projFilePath)).toString();

		// verify no project guid
		should(projFileText.includes(constants.ProjectGuid)).equal(false);

		const project: Project = await Project.openProject(projFilePath);

		// verify project guid was added
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(project.projectGuid).not.equal(undefined);
		should(projFileText.includes(constants.ProjectGuid)).equal(true);
	});

	it('Should handle adding existing items to project', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectBaseline);
		const projectFolder = path.dirname(projFilePath);

		// Create a sql file inside project root
		const sqlFile = path.join(projectFolder, 'test.sql');
		await fs.writeFile(sqlFile, '');

		const project: Project = await Project.openProject(projFilePath);

		// Add it as existing file
		await project.addExistingItem(sqlFile);

		// Validate it has been added to project
		should(project.files.length).equal(1, 'Only one entry is expected in the project');
		const sqlFileEntry = project.files.find(f => f.type === EntryType.File && f.relativePath === 'test.sql');
		should(sqlFileEntry).not.equal(undefined);

		// Validate project XML should not have changed as the file falls under default glob
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Build Include="test.sql" />')).equal(false, projFileText);

		// Exclude this file, verify the <Build Remove=...> is added
		await project.exclude(sqlFileEntry!);
		should(project.files.length).equal(0, 'Project should not have any files remaining.');
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Build Remove="test.sql" />')).equal(true, projFileText);

		// Add the file back, verify the <Build Remove=...> is no longer there
		await project.addExistingItem(sqlFile);
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Build Remove="test.sql" />')).equal(false, projFileText);
		should(projFileText.includes('<Build Include="test.sql" />')).equal(false, projFileText);

		// Now create a txt file and add it to sqlproj
		const txtFile = path.join(projectFolder, 'test.txt');
		await fs.writeFile(txtFile, '');
		await project.addExistingItem(txtFile);

		// Validate the txt file is added as <None Include=...>
		should(project.files.find(f => f.type === EntryType.File && f.relativePath === 'test.txt')).not.equal(undefined);
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<None Include="test.txt" />')).equal(true, projFileText);

		// Test with a sql file that's outside project root
		const externalSqlFile = path.join(os.tmpdir(), `Test_${new Date().getTime()}.sql`);
		const externalFileRelativePath = convertSlashesForSqlProj(path.relative(projectFolder, externalSqlFile));
		await fs.writeFile(externalSqlFile, '');
		await project.addExistingItem(externalSqlFile);
		should(project.files.find(f => f.type === EntryType.File && f.relativePath === externalFileRelativePath)).not.equal(undefined);
		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes(`<Build Include="${externalFileRelativePath}" />`)).equal(true, projFileText);
	});
});

describe('Project: add SQLCMD Variables', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	it('Should update .sqlproj with new sqlcmd variables', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline);
		const project = await Project.openProject(projFilePath);
		should(Object.keys(project.sqlCmdVariables).length).equal(2);

		// add a new variable
		await project.addSqlCmdVariable('TestDatabaseName', 'TestDb');

		// add a variable with the same name as an existing sqlcmd variable and the old entry should be replaced with the new one
		await project.addSqlCmdVariable('ProdDatabaseName', 'NewProdName');

		should(Object.keys(project.sqlCmdVariables).length).equal(3);
		should(project.sqlCmdVariables['TestDatabaseName']).equal('TestDb');
		should(project.sqlCmdVariables['ProdDatabaseName']).equal('NewProdName', 'ProdDatabaseName value should have been updated to the new value');

		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).equal(baselines.openSqlProjectWithAdditionalSqlCmdVariablesBaseline.trim());
	});
});

describe('Project: properties', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	it('Should read target database version', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.getProjectTargetVersion()).equal('150');
	});

	it('Should throw on missing target database version', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.sqlProjectMissingVersionBaseline);
		const project = await Project.openProject(projFilePath);

		should(() => project.getProjectTargetVersion()).throw('Invalid DSP in .sqlproj file');
	});

	it('Should throw on invalid target database version', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.sqlProjectInvalidVersionBaseline);
		const project = await Project.openProject(projFilePath);

		should(() => project.getProjectTargetVersion()).throw('Invalid DSP in .sqlproj file');
	});

	it('Should read default database collation', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.sqlProjectCustomCollationBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.getDatabaseDefaultCollation()).equal('SQL_Latin1_General_CP1255_CS_AS');
	});

	it('Should return default value when database collation is not specified', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.getDatabaseDefaultCollation()).equal('SQL_Latin1_General_CP1_CI_AS');
	});

	it('Should throw on invalid default database collation', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.sqlProjectInvalidCollationBaseline);
		const project = await Project.openProject(projFilePath);

		should(() => project.getDatabaseDefaultCollation())
			.throw('Invalid value specified for the property \'DefaultCollation\' in .sqlproj file');
	});

	it('Should add database source to project property', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.sqlProjectInvalidCollationBaseline);
		const project = await Project.openProject(projFilePath);

		// Should add a single database source
		await project.addDatabaseSource('test1');
		let databaseSourceItems: string[] = project.getDatabaseSourceValues();
		should(databaseSourceItems.length).equal(1);
		should(databaseSourceItems[0]).equal('test1');

		// Should add multiple database sources
		await project.addDatabaseSource('test2');
		await project.addDatabaseSource('test3');
		databaseSourceItems = project.getDatabaseSourceValues();
		should(databaseSourceItems.length).equal(3);
		should(databaseSourceItems[0]).equal('test1');
		should(databaseSourceItems[1]).equal('test2');
		should(databaseSourceItems[2]).equal('test3');

		// Should not add duplicate database sources
		await project.addDatabaseSource('test1');
		await project.addDatabaseSource('test2');
		await project.addDatabaseSource('test3');
		should(databaseSourceItems.length).equal(3);
		should(databaseSourceItems[0]).equal('test1');
		should(databaseSourceItems[1]).equal('test2');
		should(databaseSourceItems[2]).equal('test3');
	});

	it('Should remove database source from project property', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.sqlProjectInvalidCollationBaseline);
		const project = await Project.openProject(projFilePath);

		await project.addDatabaseSource('test1');
		await project.addDatabaseSource('test2');
		await project.addDatabaseSource('test3');
		await project.addDatabaseSource('test4');

		let databaseSourceItems: string[] = project.getDatabaseSourceValues();
		should(databaseSourceItems.length).equal(4);

		// Should remove database sources
		await project.removeDatabaseSource('test2');
		await project.removeDatabaseSource('test1');
		await project.removeDatabaseSource('test4');

		databaseSourceItems = project.getDatabaseSourceValues();
		should(databaseSourceItems.length).equal(1);
		should(databaseSourceItems[0]).equal('test3');

		// Should remove database source tag when last database source is removed
		await project.removeDatabaseSource('test3');
		databaseSourceItems = project.getDatabaseSourceValues();

		should(databaseSourceItems.length).equal(0);
	});

	it('Should add and remove values from project properties according to specified case sensitivity', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.sqlProjectInvalidCollationBaseline);
		const project = await Project.openProject(projFilePath);
		const propertyName = 'TestProperty';

		// Should add value to collection
		await project['addValueToCollectionProjectProperty'](propertyName, 'test');
		should(project['evaluateProjectPropertyValue'](propertyName)).equal('test');

		// Should not allow duplicates of different cases when comparing case insitively
		await project['addValueToCollectionProjectProperty'](propertyName, 'TEST');
		should(project['evaluateProjectPropertyValue'](propertyName)).equal('test');

		// Should allow duplicates of differnt cases when comparing case sensitively
		await project['addValueToCollectionProjectProperty'](propertyName, 'TEST', true);
		should(project['evaluateProjectPropertyValue'](propertyName)).equal('test;TEST');

		// Should remove values case insesitively
		await project['removeValueFromCollectionProjectProperty'](propertyName, 'Test');
		should(project['evaluateProjectPropertyValue'](propertyName)).equal('TEST');

		// Should remove values case sensitively
		await project['removeValueFromCollectionProjectProperty'](propertyName, 'Test', true);
		should(project['evaluateProjectPropertyValue'](propertyName)).equal('TEST');
		await project['removeValueFromCollectionProjectProperty'](propertyName, 'TEST', true);
		should(project['evaluateProjectPropertyValue'](propertyName)).equal(undefined);
	});

	it('Should only return well known database strings when getWellKnownDatabaseSourceString function is called', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.sqlProjectInvalidCollationBaseline);
		const project = await Project.openProject(projFilePath);

		await project.addDatabaseSource('test1');
		await project.addDatabaseSource('test2');
		await project.addDatabaseSource('test3');
		await project.addDatabaseSource(constants.WellKnownDatabaseSources[0]);

		should(getWellKnownDatabaseSources(project.getDatabaseSourceValues()).length).equal(1);
		should(getWellKnownDatabaseSources(project.getDatabaseSourceValues())[0]).equal(constants.WellKnownDatabaseSources[0]);
	});

	it('Should throw error when adding or removing database source that contains semicolon', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.sqlProjectInvalidCollationBaseline);
		const project = await Project.openProject(projFilePath);
		const semicolon = ';';

		await testUtils.shouldThrowSpecificError(
			async () => await project.addDatabaseSource(semicolon),
			constants.invalidProjectPropertyValueProvided(semicolon));

		await testUtils.shouldThrowSpecificError(
			async () => await project.removeDatabaseSource(semicolon),
			constants.invalidProjectPropertyValueProvided(semicolon));
	});
});

describe('Project: round trip updates', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	beforeEach(function (): void {
		sinon.restore();
	});

	it('Should update SSDT project to work in ADS', async function (): Promise<void> {
		await testUpdateInRoundTrip(baselines.SSDTProjectFileBaseline, baselines.SSDTProjectAfterUpdateBaseline);
	});

	it('Should update SSDT project with new system database references', async function (): Promise<void> {
		await testUpdateInRoundTrip(baselines.SSDTUpdatedProjectBaseline, baselines.SSDTUpdatedProjectAfterSystemDbUpdateBaseline);
	});

	it('Should update SSDT project to work in ADS handling pre-existing targets', async function (): Promise<void> {
		await testUpdateInRoundTrip(baselines.SSDTProjectBaselineWithBeforeBuildTarget, baselines.SSDTProjectBaselineWithBeforeBuildTargetAfterUpdate);
	});

	it('Should not update project and no backup file should be created when update to project is rejected', async function (): Promise<void> {
		sinon.stub(window, 'showWarningMessage').returns(<any>Promise.resolve(constants.noString));
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.SSDTProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const project = await Project.openProject(Uri.file(sqlProjPath).fsPath);

		should(await exists(sqlProjPath + '_backup')).equal(false);	// backup file should not be generated
		should(project.importedTargets.length).equal(2); // additional target should not be added by updateProjectForRoundTrip method

		sinon.restore();
	});

	it('Should not show warning message for non-SSDT projects that have the additional information for Build', async function (): Promise<void> {
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.openProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(baselines.openDataSourcesBaseline, folderPath);

		const project = await Project.openProject(Uri.file(sqlProjPath).fsPath);	// no error thrown

		should(project.importedTargets.length).equal(3); // additional target should exist by default
	});

	it('Should not show update project warning message when opening sdk style project using Sdk node', async function (): Promise<void> {
		await shouldNotShowUpdateWarning(baselines.newSdkStyleProjectSdkNodeBaseline);
	});

	it('Should not show update project warning message when opening sdk style project using Project node with Sdk attribute', async function (): Promise<void> {
		await shouldNotShowUpdateWarning(baselines.newSdkStyleProjectSdkProjectAttributeBaseline);
	});

	it('Should not show update project warning message when opening sdk style project using Import node with Sdk attribute', async function (): Promise<void> {
		await shouldNotShowUpdateWarning(baselines.newStyleProjectSdkImportAttributeBaseline);
	});

	async function shouldNotShowUpdateWarning(baselineFile: string): Promise<void> {
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselineFile, folderPath);
		const spy = sinon.spy(window, 'showWarningMessage');

		const project = await Project.openProject(Uri.file(sqlProjPath).fsPath);
		should(spy.notCalled).be.true();
		should(project.isSdkStyleProject).be.true();
	}
});

async function testUpdateInRoundTrip(fileBeforeupdate: string, fileAfterUpdate: string): Promise<void> {
	const stub = sinon.stub(window, 'showWarningMessage').returns(<any>Promise.resolve(constants.yesString));

	projFilePath = await testUtils.createTestSqlProjFile(fileBeforeupdate);
	const project = await Project.openProject(projFilePath); // project gets updated if needed in openProject()

	should(await exists(projFilePath + '_backup')).equal(true, 'Backup file should have been generated before the project was updated');
	should(project.importedTargets.length).equal(3);	// additional target added by updateProjectForRoundTrip method

	let projFileText = (await fs.readFile(projFilePath)).toString();
	should(projFileText).equal(fileAfterUpdate.trim());

	should(stub.calledOnce).be.true('showWarningMessage should have been called exactly once');
	sinon.restore();
}

describe('Project: legacy to SDK-style updates', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	beforeEach(function (): void {
		sinon.restore();
	});

	it('Should update legacy style project to SDK-style', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const list: Uri[] = [];
		await testUtils.createDummyFileStructure(true, list, path.dirname(projFilePath));
		const project = await Project.openProject(projFilePath);
		await project.addToProject(list);

		const beforeFileCount = project.files.filter(f => f.type === EntryType.File).length;
		const beforeFolderCount = project.files.filter(f => f.type === EntryType.Folder).length;
		should(beforeFolderCount).equal(2, 'There should be 2 folders in the project');
		should(beforeFileCount).equal(11, 'There should be 11 files in the project');
		should(project.importedTargets.length).equal(3, 'SSDT and ADS imports should be in the project');
		should(project.isSdkStyleProject).equal(false);
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Build Include=')).equal(true, 'sqlproj should have Build Includes before converting');
		should(projFileText.includes('<Folder Include=')).equal(true, 'sqlproj should have Folder Includes before converting');
		should(projFileText.includes('<VisualStudioVersion Condition="\'$(VisualStudioVersion)\' == \'\'">')).equal(true, 'sqlproj should have VisualStudioVersion property with empty condition before converting');
		should(projFileText.includes('<SSDTExists Condition="Exists(\'$(MSBuildExtensionsPath)\\Microsoft\\VisualStudio\\v$(VisualStudioVersion)\\SSDT\\Microsoft.Data.Tools.Schema.SqlTasks.targets\')">')).equal(true, 'sqlproj should have SSDTExists property before converting');
		should(projFileText.includes('<VisualStudioVersion Condition="\'$(SSDTExists)\' == \'\'">')).equal(true, 'sqlproj should have VisualStudioVersion property with SSDTExists condition before converting');

		await project.convertProjectToSdkStyle();

		should(await exists(projFilePath + '_backup')).equal(true, 'Backup file should have been generated before the project was updated');
		should(project.importedTargets.length).equal(0, 'SSDT and ADS imports should have been removed');
		should(project.isSdkStyleProject).equal(true);

		projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Build Include=')).equal(false, 'All Build Includes should have been removed');
		should(projFileText.includes('<Folder Include=')).equal(false, 'All Folder Includes should have been removed');
		should(project.files.filter(f => f.type === EntryType.File).length).equal(beforeFileCount, 'Same number of files should be included after Build Includes are removed');
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(beforeFolderCount, 'Same number of folders should be included after Folder Includes are removed');
		should(projFileText.includes('<VisualStudioVersion Condition="\'$(VisualStudioVersion)\' == \'\'">')).equal(false, 'VisualStudioVersion property with empty condition should be removed');
		should(projFileText.includes('<SSDTExists Condition="Exists(\'$(MSBuildExtensionsPath)\\Microsoft\\VisualStudio\\v$(VisualStudioVersion)\\SSDT\\Microsoft.Data.Tools.Schema.SqlTasks.targets\')">')).equal(false, 'SSDTExists property should be removed');
		should(projFileText.includes('<VisualStudioVersion Condition="\'$(SSDTExists)\' == \'\'">')).equal(false, 'VisualStudioVersion property with SSDTExists condition should be removed');
	});

	it('Should not fail if legacy style project does not have Properties folder in sqlproj', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileNoPropertiesFolderBaseline);
		const list: Uri[] = [];
		await testUtils.createDummyFileStructure(true, list, path.dirname(projFilePath));
		const project = await Project.openProject(projFilePath);
		await project.addToProject(list);

		const beforeFolderCount = project.files.filter(f => f.type === EntryType.Folder).length;

		await project.convertProjectToSdkStyle();

		should(project.isSdkStyleProject).equal(true);
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Folder Include=')).equal(false, 'All Folder Includes should have been removed');
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(beforeFolderCount, 'Same number of folders should be included after Folder Includes are removed');
	});

	it('Should exclude sql files that were not in previously included in legacy style sqlproj', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const list: Uri[] = [];
		await testUtils.createDummyFileStructure(true, list, path.dirname(projFilePath));
		const project = await Project.openProject(projFilePath);

		// don't add file1.sql, folder1\file1.sql and folder2\file1.sql
		await project.addToProject(list.filter(f => !f.fsPath.includes('file1.sql')));

		const beforeFileCount = project.files.filter(f => f.type === EntryType.File).length;
		const beforeFolderCount = project.files.filter(f => f.type === EntryType.Folder).length;
		should(beforeFileCount).equal(8, 'There should be 8 files in the project before converting');

		await project.convertProjectToSdkStyle();

		should(project.isSdkStyleProject).equal(true);
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Build Include=')).equal(false, 'All Build Includes should have been removed');
		should(projFileText.match(/<Build Remove=\W+(?:\w+\W+){0,2}?file1.sql/g)?.length).equal(3, 'There should be 3 Build Removes for the 3 file1.sql files');
		should(projFileText.includes('<Folder Include=')).equal(false, 'All Folder Includes should have been removed');
		should(project.files.filter(f => f.type === EntryType.File).length).equal(beforeFileCount, 'Same number of files should be included after Build Includes are removed');
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(beforeFolderCount, 'Same number of folders should be included after Folder Includes are removed');
	});

	it('Should keep Build Includes for files outside of project folder', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath();
		const mainProjectPath =  path.join(testFolderPath, 'project');
		const otherFolderPath = path.join(testFolderPath, 'other');
		projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline, mainProjectPath);
		let list: Uri[] = [];
		await testUtils.createDummyFileStructure(true, list, path.dirname(projFilePath));

		// create files outside of project folder that are included in the project file
		await fs.mkdir(otherFolderPath);
		const otherFiles = await testUtils.createOtherDummyFiles(otherFolderPath);
		list = list.concat(otherFiles);

		const project = await Project.openProject(projFilePath);

		// add all the files, except the pre and post deploy scripts
		await project.addToProject(list.filter(f => !f.fsPath.includes('Script.')));

		const beforeFileCount = project.files.filter(f => f.type === EntryType.File).length;
		const beforeFolderCount = project.files.filter(f => f.type === EntryType.Folder).length;
		should(beforeFileCount).equal(19, 'There should be 19 files in the project');

		await project.convertProjectToSdkStyle();

		should(project.isSdkStyleProject).equal(true);
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.match(/<Build Include=/g)?.length).equal(8, 'There should be Build includes for the 8 .sql files outside of the project folder');
		should(projFileText.includes('<Folder Include=')).equal(false, 'All Folder Includes should have been removed');
		should(project.files.filter(f => f.type === EntryType.File).length).equal(beforeFileCount, 'Same number of files should be included after Build Includes are removed');
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(beforeFolderCount, 'Same number of folders should be included after Folder Includes are removed');
	});

	it('Should list previously included empty folders in sqlproj after converting to SDK-style', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline);
		const list: Uri[] = [];
		const folderPath = path.dirname(projFilePath);
		await testUtils.createDummyFileStructure(true, list, folderPath);
		const project = await Project.openProject(projFilePath);
		await project.addToProject(list);

		await project.addFolderItem('folder3');
		await project.addFolderItem('folder3\\nestedFolder');
		await project.addFolderItem('folder4');

		const beforeFolderCount = project.files.filter(f => f.type === EntryType.Folder).length;
		should(beforeFolderCount).equal(5);

		await project.convertProjectToSdkStyle();

		should(project.isSdkStyleProject).equal(true);
		const projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText.includes('<Folder Include="folder3\\" />')).equal(false, 'There should not be a folder include for folder3\\nestedFolder because it gets included by the nestedFolder entry');
		should(projFileText.includes('<Folder Include="folder3\\nestedFolder\\" />')).equal(true, 'There should be a folder include for folder3\\nestedFolder');
		should(projFileText.includes('<Folder Include="folder4\\" />')).equal(true, 'There should be a folder include for folder4');
		should(project.files.filter(f => f.type === EntryType.Folder).length).equal(beforeFolderCount, 'Same number of folders should be included after Folder Includes are removed');
	});

	it('Should rollback changes if there was an error during conversion to SDK-style', async function (): Promise<void> {
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.newProjectFileBaseline, folderPath);
		const project = await Project.openProject(Uri.file(sqlProjPath).fsPath);
		should(project.isSdkStyleProject).equal(false);

		// add an empty folder so that addFolderItem() will get called during the conversion. Empty folders aren't included by glob, so they need to be added to the sqlproj
		// to show up in the project tree
		await project.addFolderItem('folder1');

		sinon.stub(Project.prototype, 'addFolderItem').throwsException('error');
		const result = await project.convertProjectToSdkStyle();

		should(result).equal(false);
		should(project.isSdkStyleProject).equal(false);
		should(project.importedTargets.length).equal(3, 'SSDT and ADS imports should still be there');
	});

	it('Should not update project and no backup file should be created when project is already SDK-style', async function (): Promise<void> {
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.openSdkStyleSqlProjectBaseline, folderPath);

		const project = await Project.openProject(Uri.file(sqlProjPath).fsPath);
		should(project.isSdkStyleProject).equal(true);
		await project.convertProjectToSdkStyle();

		should(await exists(sqlProjPath + '_backup')).equal(false, 'No backup file should have been created');
		should(project.isSdkStyleProject).equal(true);
	});

	it('Should not update project and no backup file should be created when it is an SSDT project that has not been updated to work in ADS', async function (): Promise<void> {
		sinon.stub(window, 'showWarningMessage').returns(<any>Promise.resolve(constants.noString));
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath();
		const sqlProjPath = await testUtils.createTestSqlProjFile(baselines.SSDTProjectFileBaseline, folderPath);

		const project = await Project.openProject(Uri.file(sqlProjPath).fsPath);
		should(project.isSdkStyleProject).equal(false);
		should(project.importedTargets.length).equal(2, 'Project should have 2 SSDT imports');
		await project.convertProjectToSdkStyle();

		should(await exists(sqlProjPath + '_backup')).equal(false, 'No backup file should have been created');
		should(project.importedTargets.length).equal(2, 'Project imports should not have been changed');
		should(project.isSdkStyleProject).equal(false);
	});
});

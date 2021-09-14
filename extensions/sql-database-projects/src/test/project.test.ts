/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as sinon from 'sinon';
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';
import * as testUtils from './testUtils';
import * as constants from '../common/constants';

import { promises as fs } from 'fs';
import { Project, EntryType, SystemDatabase, SystemDatabaseReferenceProjectEntry, SqlProjectReferenceProjectEntry } from '../models/project';
import { exists, convertSlashesForSqlProj } from '../common/utils';
import { Uri, window } from 'vscode';
import { IDacpacReferenceSettings, IProjectReferenceSettings, ISystemDatabaseReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { SqlTargetPlatform } from 'sqldbproj';

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

		should(project.files.find(f => f.type === EntryType.Folder && f.relativePath === 'Views\\User')).not.equal(undefined); // mixed ItemGroup folder
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
		await project.addScriptItem(scriptPathTagged, scriptContentsTagged, templates.externalStreamingJob);

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
		await testUtils.shouldThrowSpecificError(async () => await project.getSystemDacpacUri(constants.masterDacpac), constants.invalidDataSchemaProvider);
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
		await project.addScriptItem(preDeploymentScriptFilePath, fileContents, templates.preDeployScript);
		await project.addScriptItem(postDeploymentScriptFilePath, fileContents, templates.postDeployScript);

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
		await project.addScriptItem(preDeploymentScriptFilePath, fileContents, templates.preDeployScript);
		await project.addScriptItem(postDeploymentScriptFilePath, fileContents, templates.postDeployScript);

		await project.addScriptItem(preDeploymentScriptFilePath2, fileContents, templates.preDeployScript);
		should(stub.calledWith(constants.deployScriptExists(constants.PreDeploy))).be.true(`showInformationMessage not called with expected message '${constants.deployScriptExists(constants.PreDeploy)}' Actual '${stub.getCall(0).args[0]}'`);

		await project.addScriptItem(postDeploymentScriptFilePath2, fileContents, templates.postDeployScript);
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

		should(() => project.getProjectTargetVersion()).throw("Invalid DSP in .sqlproj file");
	});

	it('Should throw on invalid target database version', async function (): Promise<void> {
		projFilePath = await testUtils.createTestSqlProjFile(baselines.sqlProjectInvalidVersionBaseline);
		const project = await Project.openProject(projFilePath);

		should(() => project.getProjectTargetVersion()).throw("Invalid DSP in .sqlproj file");
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
});

describe('Project: round trip updates', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	it('Should update SSDT project to work in ADS', async function (): Promise<void> {
		await testUpdateInRoundTrip(baselines.SSDTProjectFileBaseline, baselines.SSDTProjectAfterUpdateBaseline);
	});

	it('Should update SSDT project with new system database references', async function (): Promise<void> {
		await testUpdateInRoundTrip(baselines.SSDTUpdatedProjectBaseline, baselines.SSDTUpdatedProjectAfterSystemDbUpdateBaseline);
	});

	it('Should update SSDT project to work in ADS handling pre-exsiting targets', async function (): Promise<void> {
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



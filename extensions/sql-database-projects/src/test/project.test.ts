/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as sinon from 'sinon';
import * as baselines from './baselines/baselines';
import * as testUtils from './testUtils';
import * as constants from '../common/constants';

import { promises as fs } from 'fs';
import { Project } from '../models/project';
import { exists, convertSlashesForSqlProj, getPlatformSafeFileEntryPath, systemDatabaseToString } from '../common/utils';
import { Uri, window } from 'vscode';
import { IDacpacReferenceSettings, INugetPackageReferenceSettings, IProjectReferenceSettings, ISystemDatabaseReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { ItemType } from 'sqldbproj';
import { SystemDatabaseReferenceProjectEntry, SqlProjectReferenceProjectEntry, DacpacReferenceProjectEntry } from '../models/projectEntry';
import { ProjectType, SystemDatabase, SystemDbReferenceType } from 'mssql';

describe('Project: sqlproj content operations', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	after(async function (): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should read Project from sqlproj', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openProjectFileBaseline);
		const project: Project = await Project.openProject(projFilePath);

		// Files and folders
		(project.sqlObjectScripts.map(f => f.relativePath)).should.deepEqual([
			'..\\Test\\Test.sql',
			'MyExternalStreamingJob.sql',
			'Tables\\Action History.sql',
			'Tables\\Users.sql',
			'Views\\Maintenance\\Database Performance.sql',
			'Views\\User\\Profile.sql']);

		(project.folders.map(f => f.relativePath)).should.deepEqual([
			'Tables',
			'Views',
			'Views\\Maintenance',
			'Views\\User']);

		// SqlCmdVariables
		should(project.sqlCmdVariables.size).equal(2);
		should(project.sqlCmdVariables.get('ProdDatabaseName')).equal('MyProdDatabase');
		should(project.sqlCmdVariables.get('BackupDatabaseName')).equal('MyBackupDatabase');

		// Database references
		// should only have one database reference even though there are two master.dacpac references (1 for ADS and 1 for SSDT)
		should(project.databaseReferences.length).equal(1);
		should(project.databaseReferences[0].referenceName).containEql(constants.master);
		should(project.databaseReferences[0] instanceof SystemDatabaseReferenceProjectEntry).equal(true);

		// Pre-post deployment scripts
		should(project.preDeployScripts.length).equal(1);
		should(project.postDeployScripts.length).equal(1);
		should(project.noneDeployScripts.length).equal(2);
		should(project.preDeployScripts.find(f => f.relativePath === 'Script.PreDeployment1.sql')).not.equal(undefined, 'File Script.PreDeployment1.sql not read');
		should(project.postDeployScripts.find(f => f.relativePath === 'Script.PostDeployment1.sql')).not.equal(undefined, 'File Script.PostDeployment1.sql not read');
		should(project.noneDeployScripts.find(f => f.relativePath === 'Script.PreDeployment2.sql')).not.equal(undefined, 'File Script.PostDeployment2.sql not read');
		should(project.noneDeployScripts.find(f => f.relativePath === 'Tables\\Script.PostDeployment1.sql')).not.equal(undefined, 'File Tables\\Script.PostDeployment1.sql not read');

		// Publish profiles
		should(project.publishProfiles.length).equal(3);
		should(project.publishProfiles.find(f => f.relativePath === 'TestProjectName_1.publish.xml')).not.equal(undefined, 'Profile TestProjectName_1.publish.xml not read');
		should(project.publishProfiles.find(f => f.relativePath === 'TestProjectName_2.publish.xml')).not.equal(undefined, 'Profile TestProjectName_2.publish.xml not read');
		should(project.publishProfiles.find(f => f.relativePath === 'TestProjectName_3.publish.xml')).not.equal(undefined, 'Profile TestProjectName_3.publish.xml not read');
	});

	it('Should read Project with Project reference from sqlproj', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openProjectWithProjectReferencesBaseline);
		const project: Project = await Project.openProject(projFilePath);

		// Database references
		// should only have two database references even though there are two master.dacpac references (1 for ADS and 1 for SSDT)
		(project.databaseReferences.length).should.equal(2);
		(project.databaseReferences[0].referenceName).should.containEql('ReferencedTestProject');
		(project.databaseReferences[0] instanceof SqlProjectReferenceProjectEntry).should.be.true();
		(project.databaseReferences[1].referenceName).should.containEql(constants.master);
		(project.databaseReferences[1] instanceof SystemDatabaseReferenceProjectEntry).should.be.true();
	});

	it('Should throw warning message while reading Project with more than 1 pre-deploy script from sqlproj', async function (): Promise<void> {
		const stub = sinon.stub(window, 'showWarningMessage').returns(<any>Promise.resolve(constants.okString));

		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openSqlProjectWithPrePostDeploymentError);
		const project: Project = await Project.openProject(projFilePath);

		should(stub.calledOnce).be.true('showWarningMessage should have been called exactly once');
		should(stub.calledWith(constants.prePostDeployCount)).be.true(`showWarningMessage not called with expected message '${constants.prePostDeployCount}' Actual '${stub.getCall(0).args[0]}'`);

		should(project.preDeployScripts.length).equal(2);
		should(project.postDeployScripts.length).equal(1);
		should(project.noneDeployScripts.length).equal(1);
		should(project.preDeployScripts.find(f => f.relativePath === 'Script.PreDeployment1.sql')).not.equal(undefined, 'File Script.PreDeployment1.sql not read');
		should(project.postDeployScripts.find(f => f.relativePath === 'Script.PostDeployment1.sql')).not.equal(undefined, 'File Script.PostDeployment1.sql not read');
		should(project.preDeployScripts.find(f => f.relativePath === 'Script.PreDeployment2.sql')).not.equal(undefined, 'File Script.PostDeployment2.sql not read');
		should(project.noneDeployScripts.find(f => f.relativePath === 'Tables\\Script.PostDeployment1.sql')).not.equal(undefined, 'File Tables\\Script.PostDeployment1.sql not read');

		sinon.restore();
	});

	it('Should perform Folder and SQL object script operations', async function (): Promise<void> {
		const project = await testUtils.createTestSqlProject(this.test);

		const folderPath = 'Stored Procedures';
		const scriptPath = path.join(folderPath, 'Fake Stored Proc.sql');
		const scriptContents = 'SELECT \'This is not actually a stored procedure.\'';

		const scriptPathTagged = path.join(folderPath, 'Fake External Streaming Job.sql');
		const scriptContentsTagged = 'EXEC sys.sp_create_streaming_job \'job\', \'SELECT 7\'';

		(project.folders.length).should.equal(0);
		(project.sqlObjectScripts.length).should.equal(0);

		await project.addFolder(folderPath);
		await project.addScriptItem(scriptPath, scriptContents);
		await project.addScriptItem(scriptPathTagged, scriptContentsTagged, ItemType.externalStreamingJob);

		(project.folders.length).should.equal(1);
		(project.sqlObjectScripts.length).should.equal(2);

		should(project.folders.find(f => f.relativePath === convertSlashesForSqlProj(folderPath))).not.equal(undefined);
		should(project.sqlObjectScripts.find(f => f.relativePath === convertSlashesForSqlProj(scriptPath))).not.equal(undefined);
		should(project.sqlObjectScripts.find(f => f.relativePath === convertSlashesForSqlProj(scriptPathTagged))).not.equal(undefined);
		// TODO: support for tagged entries not supported in DacFx.Projects
		//should(project.files.find(f => f.relativePath === convertSlashesForSqlProj(scriptPathTagged))?.sqlObjectType).equal(constants.ExternalStreamingJob);
	});

	it('Should bulk-add scripts to sqlproj with pre-existing scripts on disk', async function (): Promise<void> {
		const project = await testUtils.createTestSqlProject(this.test);

		// initial setup
		(project.sqlObjectScripts.length).should.equal(0, 'initial number of scripts');

		// create files on disk
		const tablePath = path.join(project.projectFolderPath, 'MyTable.sql');
		await fs.writeFile(tablePath, 'CREATE TABLE [MyTable] ([Name] [nvarchar(50)');

		const viewPath = path.join(project.projectFolderPath, 'MyView.sql');
		await fs.writeFile(viewPath, 'CREATE VIEW [MyView] AS SELECT * FROM [MyTable]');

		// add to project
		await project.addSqlObjectScripts(['MyTable.sql', 'MyView.sql']);

		// verify result
		(project.sqlObjectScripts.length).should.equal(2, 'Number of scripts after adding');
	});

	// TODO: move to DacFx once script contents supported
	it('Should throw error while adding folders and SQL object scripts to sqlproj when a file does not exist on disk', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openProjectFileBaseline);
		const project = await testUtils.createTestSqlProject(this.test);

		let list: Uri[] = [];
		let testFolderPath: string = await testUtils.createDummyFileStructure(this.test, true, list, path.dirname(projFilePath));

		const nonexistentFile = path.join(testFolderPath, 'nonexistentFile.sql');
		list.push(Uri.file(nonexistentFile));

		const relativePaths = list.map(f => path.relative(project.projectFolderPath, f.fsPath));

		await testUtils.shouldThrowSpecificError(async () => await project.addSqlObjectScripts(relativePaths), `Error: No script found at '${nonexistentFile}'`);
	});

	it('Should perform pre-deployment script operations', async function (): Promise<void> {
		let project = await testUtils.createTestSqlProject(this.test);

		const relativePath = 'Script.PreDeployment1.sql';
		const absolutePath = path.join(project.projectFolderPath, relativePath);
		const fileContents = 'SELECT 7';

		// initial state
		(project.preDeployScripts.length).should.equal(0, 'initial state');
		(await exists(absolutePath)).should.be.false('inital state');

		// add new
		await project.addScriptItem(relativePath, fileContents, ItemType.preDeployScript);
		(project.preDeployScripts.length).should.equal(1);
		(await exists(absolutePath)).should.be.true('add new');

		// read
		project = await Project.openProject(project.projectFilePath);
		(project.preDeployScripts.length).should.equal(1, 'read');
		(project.preDeployScripts[0].relativePath).should.equal(relativePath, 'read');

		// exclude
		await project.excludePreDeploymentScript(relativePath);
		(project.preDeployScripts.length).should.equal(0, 'exclude');
		(await exists(absolutePath)).should.be.true('exclude');

		// add existing
		await project.addScriptItem(relativePath, undefined, ItemType.preDeployScript);
		(project.preDeployScripts.length).should.equal(1, 'add existing');

		//delete
		await project.deletePreDeploymentScript(relativePath);
		(project.preDeployScripts.length).should.equal(0, 'delete');
		(await exists(absolutePath)).should.be.false('delete');
	});

	it('Should show information messages when adding more than one pre/post deployment scripts to sqlproj', async function (): Promise<void> {
		const stub = sinon.stub(window, 'showInformationMessage').returns(<any>Promise.resolve());

		const project: Project = await testUtils.createTestSqlProject(this.test);

		const preDeploymentScriptFilePath = 'Script.PreDeployment1.sql';
		const postDeploymentScriptFilePath = 'Script.PostDeployment1.sql';
		const preDeploymentScriptFilePath2 = 'Script.PreDeployment2.sql';
		const postDeploymentScriptFilePath2 = 'Script.PostDeployment2.sql';
		const fileContents = 'SELECT 7';

		await project.addScriptItem(preDeploymentScriptFilePath, fileContents, ItemType.preDeployScript);
		await project.addScriptItem(postDeploymentScriptFilePath, fileContents, ItemType.postDeployScript);

		(stub.notCalled).should.be.true('showInformationMessage should not have been called');

		await project.addScriptItem(preDeploymentScriptFilePath2, fileContents, ItemType.preDeployScript);
		(stub.calledOnce).should.be.true('showInformationMessage should have been called once after adding extra pre-deployment script');
		(stub.calledWith(constants.deployScriptExists(constants.PreDeploy))).should.be.true(`showInformationMessage not called with expected message '${constants.deployScriptExists(constants.PreDeploy)}'; actual: '${stub.firstCall.args[0]}'`);

		stub.resetHistory();

		await project.addScriptItem(postDeploymentScriptFilePath2, fileContents, ItemType.postDeployScript);
		(stub.calledOnce).should.be.true('showInformationMessage should have been called once after adding extra post-deployment script');
		should(stub.calledWith(constants.deployScriptExists(constants.PostDeploy))).be.true(`showInformationMessage not called with expected message '${constants.deployScriptExists(constants.PostDeploy)}' Actual '${stub.getCall(0).args[0]}'`);
	});

	// TODO: move to DacFx once script contents supported
	it('Should not overwrite existing files', async function (): Promise<void> {
		// Create new sqlproj
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		const fileList = await testUtils.createListOfFiles(this.test, path.dirname(projFilePath));

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

	// TODO: revisit correct behavior for this, since DacFx.Projects makes no restriction on absolute paths and external folders (which are represented as "..")
	it.skip('Should not add folders outside of the project folder', async function (): Promise<void> {
		// Create new sqlproj
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);

		let project: Project = await Project.openProject(projFilePath);

		// Try adding project root folder itself - this is silently ignored
		await project.addFolder(path.dirname(projFilePath));
		should.equal(project.sqlObjectScripts.length, 0, 'Nothing should be added to the project');

		// Try adding a parent of the project folder
		await testUtils.shouldThrowSpecificError(
			async () => await project.addFolder(path.dirname(path.dirname(projFilePath))),
			'Items with absolute path outside project folder are not supported. Please make sure the paths in the project file are relative to project folder.',
			'Folders outside the project folder should not be added.');
	});

	it('Should handle adding existing items to project', async function (): Promise<void> {
		// Create new sqlproj
		const project: Project = await testUtils.createTestSqlProject(this.test);
		// Create 2 new files, a sql file and a txt file
		const sqlFile = path.join(project.projectFolderPath, 'test.sql');
		const txtFile = path.join(project.projectFolderPath, 'foo', 'test.txt');
		await fs.writeFile(sqlFile, 'CREATE TABLE T1 (C1 INT)');
		await fs.mkdir(path.dirname(txtFile));
		await fs.writeFile(txtFile, 'Hello World!');

		await project.readProjFile();

		// Add them as existing files
		await project.addFolder('foo'); // TODO: This shouldn't be necessary; DacFx.Projects needs to refresh the in-memory folder list internally after adding items
		await project.addExistingItem(sqlFile);
		await project.addExistingItem(txtFile);

		// Validate files should have been added to project
		(project.sqlObjectScripts.length).should.equal(1, `SQL script object count: ${project.sqlObjectScripts.map(x => x.relativePath).join('; ')}`);
		(project.sqlObjectScripts[0].relativePath).should.equal('test.sql');

		should(project.folders.length).equal(1, 'folders');
		(project.folders[0].relativePath).should.equal('foo');

		should(project.noneDeployScripts.length).equal(1, '<None> items');
		(project.noneDeployScripts[0].relativePath).should.equal('foo\\test.txt');
	});

	it('Should read project properties', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.sqlProjPropertyReadBaseline);
		const project: Project = await Project.openProject(projFilePath);

		(project.sqlProjStyle).should.equal(ProjectType.SdkStyle);
		(project.outputPath).should.equal(path.join(getPlatformSafeFileEntryPath(project.projectFolderPath), getPlatformSafeFileEntryPath('CustomOutputPath\\Dacpacs\\')));
		(project.configuration).should.equal('Release');
		(project.getDatabaseSourceValues()).should.deepEqual(['oneSource', 'twoSource', 'redSource', 'blueSource']);
		(project.getProjectTargetVersion()).should.equal('130');
	});
});

describe('Project: sdk style project content operations', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	beforeEach(function (): void {
		sinon.restore();
	});

	after(async function (): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should exclude pre/post/none deploy scripts correctly', async function (): Promise<void> {
		const folderPath = await testUtils.generateTestFolderPath(this.test);
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newSdkStyleProjectSdkNodeBaseline, folderPath);

		const project: Project = await Project.openProject(projFilePath);
		await project.addScriptItem('Script.PreDeployment1.sql', 'fake contents', ItemType.preDeployScript);
		await project.addScriptItem('Script.PreDeployment2.sql', 'fake contents', ItemType.preDeployScript);
		await project.addScriptItem('Script.PostDeployment1.sql', 'fake contents', ItemType.postDeployScript);

		// verify they were added to the sqlproj
		should(project.preDeployScripts.length).equal(1, 'Script.PreDeployment1.sql should have been added');
		should(project.noneDeployScripts.length).equal(1, 'Script.PreDeployment2.sql should have been added');
		should(project.preDeployScripts.length).equal(1, 'Script.PostDeployment1.sql should have been added');
		should(project.sqlObjectScripts.length).equal(0, 'There should not be any SQL object scripts');

		// exclude the pre/post/none deploy script
		await project.excludePreDeploymentScript('Script.PreDeployment1.sql');
		await project.excludeNoneItem('Script.PreDeployment2.sql');
		await project.excludePostDeploymentScript('Script.PostDeployment1.sql');

		should(project.preDeployScripts.length).equal(0, 'Script.PreDeployment1.sql should have been removed');
		should(project.noneDeployScripts.length).equal(0, 'Script.PreDeployment2.sql should have been removed');
		should(project.postDeployScripts.length).equal(0, 'Script.PostDeployment1.sql should have been removed');
		should(project.sqlObjectScripts.length).equal(0, 'There should not be any SQL object scripts after the excludes');
	});

	it('Should handle excluding glob included folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath(this.test);
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openSdkStyleSqlProjectBaseline, testFolderPath);
		await testUtils.createDummyFileStructureWithPrePostDeployScripts(this.test, false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);

		should(project.sqlObjectScripts.length).equal(13);
		should(project.folders.length).equal(3);
		should(project.noneDeployScripts.length).equal(2);

		// try to exclude a glob included folder
		await project.excludeFolder('folder1');

		// verify folder and contents are excluded
		should(project.folders.length).equal(1);
		should(project.sqlObjectScripts.length).equal(6);
		should(project.noneDeployScripts.length).equal(1, 'Script.PostDeployment2.sql should have been excluded');
		should(project.folders.find(f => f.relativePath === 'folder1')).equal(undefined);
	});

	it('Should handle excluding folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath(this.test,);
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openSdkStyleSqlProjectBaseline, testFolderPath);
		await testUtils.createDummyFileStructureWithPrePostDeployScripts(this.test, false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);

		should(project.sqlObjectScripts.length).equal(13);
		should(project.folders.length).equal(3);

		// try to exclude a glob included folder
		await project.excludeFolder('folder1\\nestedFolder');

		// verify folder and contents are excluded
		should(project.folders.length).equal(2);
		should(project.sqlObjectScripts.length).equal(11);
		should(project.folders.find(f => f.relativePath === 'folder1\\nestedFolder')).equal(undefined);
	});

	// skipped because exclude folder not yet supported
	it('Should handle excluding explicitly included folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath(this.test,);
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openSdkStyleSqlProjectWithFilesSpecifiedBaseline, testFolderPath);
		await testUtils.createDummyFileStructure(this.test, false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);

		should(project.sqlObjectScripts.length).equal(11);
		should(project.folders.length).equal(2);
		should(project.folders.find(f => f.relativePath === 'folder1')!).not.equal(undefined);
		should(project.folders.find(f => f.relativePath === 'folder2')!).not.equal(undefined);

		// try to exclude an explicitly included folder without trailing \ in sqlproj
		await project.excludeFolder('folder1');

		// verify folder and contents are excluded
		should(project.folders.length).equal(1);
		should(project.sqlObjectScripts.length).equal(6);
		should(project.folders.find(f => f.relativePath === 'folder1')).equal(undefined);

		// try to exclude an explicitly included folder with trailing \ in sqlproj
		await project.excludeFolder('folder2');

		// verify folder and contents are excluded
		should(project.folders.length).equal(0);
		should(project.sqlObjectScripts.length).equal(1);
		should(project.folders.find(f => f.relativePath === 'folder2')).equal(undefined);
	});

	it('Should handle deleting explicitly included folders', async function (): Promise<void> {
		const testFolderPath = await testUtils.generateTestFolderPath(this.test,);
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openSdkStyleSqlProjectWithFilesSpecifiedBaseline, testFolderPath);
		await testUtils.createDummyFileStructureWithPrePostDeployScripts(this.test, false, undefined, path.dirname(projFilePath));

		const project: Project = await Project.openProject(projFilePath);

		should(project.sqlObjectScripts.length).equal(13);
		should(project.folders.length).equal(3);
		should(project.folders.find(f => f.relativePath === 'folder1')!).not.equal(undefined);
		should(project.folders.find(f => f.relativePath === 'folder2')!).not.equal(undefined);

		// try to delete an explicitly included folder with the trailing \ in sqlproj
		await project.deleteFolder('folder2');

		// verify the project not longer has folder2 and its contents
		should(project.folders.length).equal(2);
		should(project.sqlObjectScripts.length).equal(8);
		should(project.folders.find(f => f.relativePath === 'folder2')).equal(undefined);

		// try to delete an explicitly included folder without trailing \ in sqlproj
		await project.deleteFolder('folder1');

		// verify the project not longer has folder1 and its contents
		should(project.folders.length).equal(0);
		should(project.sqlObjectScripts.length).equal(1);
		should(project.folders.find(f => f.relativePath === 'folder1')).equal(undefined);
	});

	// TODO: remove once DacFx exposes both absolute and relative outputPath
	it('Should read OutputPath from sqlproj if there is one for SDK-style project', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openSdkStyleSqlProjectBaseline);
		const projFileText = (await fs.readFile(projFilePath)).toString();

		// Verify sqlproj has OutputPath
		should(projFileText.includes(constants.OutputPath)).equal(true);

		const project: Project = await Project.openProject(projFilePath);
		should(project.outputPath).equal(path.join(getPlatformSafeFileEntryPath(project.projectFolderPath), getPlatformSafeFileEntryPath('..\\otherFolder')));
		should(project.dacpacOutputPath).equal(path.join(getPlatformSafeFileEntryPath(project.projectFolderPath), getPlatformSafeFileEntryPath('..\\otherFolder'), `${project.projectFileName}.dacpac`));
	});

	// TODO: move test to DacFx
	it('Should use default output path if OutputPath is not specified in sqlproj', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openSdkStyleSqlProjectWithGlobsSpecifiedBaseline);
		const projFileText = (await fs.readFile(projFilePath)).toString();

		// Verify sqlproj doesn't have <OutputPath>
		should(projFileText.includes(`<${constants.OutputPath}>`)).equal(false);

		const project: Project = await Project.openProject(projFilePath);
		should(project.outputPath).equal(path.join(getPlatformSafeFileEntryPath(project.projectFolderPath), getPlatformSafeFileEntryPath(constants.defaultOutputPath(project.configuration.toString()))) + path.sep);
		should(project.dacpacOutputPath).equal(path.join(getPlatformSafeFileEntryPath(project.projectFolderPath), getPlatformSafeFileEntryPath(constants.defaultOutputPath(project.configuration.toString())), `${project.projectFileName}.dacpac`));
	});
});

describe('Project: database references', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	after(async function (): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should read database references correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.databaseReferencesReadBaseline);
		const project = await Project.openProject(projFilePath);
		(project.databaseReferences.length).should.equal(5, 'NUmber of database references');

		const systemRef: SystemDatabaseReferenceProjectEntry | undefined = project.databaseReferences.find(r => r instanceof SystemDatabaseReferenceProjectEntry) as SystemDatabaseReferenceProjectEntry;
		should(systemRef).not.equal(undefined, 'msdb reference');
		(systemRef!.referenceName).should.equal(constants.msdb);
		(systemRef!.databaseVariableLiteralValue!).should.equal('msdbLiteral');
		(systemRef!.suppressMissingDependenciesErrors).should.equal(true, 'suppressMissingDependenciesErrors for system db');

		let projRef: SqlProjectReferenceProjectEntry | undefined = project.databaseReferences.find(r => r instanceof SqlProjectReferenceProjectEntry && r.referenceName === 'ReferencedProject') as SqlProjectReferenceProjectEntry;
		should(projRef).not.equal(undefined, 'ReferencedProject reference');
		(projRef!.pathForSqlProj()).should.equal('..\\ReferencedProject\\ReferencedProject.sqlproj');
		(projRef!.projectGuid).should.equal('{BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575}');
		should(projRef!.databaseVariableLiteralValue).equal(null, 'databaseVariableLiteralValue for ReferencedProject');
		(projRef!.databaseSqlCmdVariableName!).should.equal('projDbVar');
		(projRef!.databaseSqlCmdVariableValue!).should.equal('$(SqlCmdVar__1)');
		(projRef!.serverSqlCmdVariableName!).should.equal('projServerVar');
		(projRef!.serverSqlCmdVariableValue!).should.equal('$(SqlCmdVar__2)');
		(projRef!.suppressMissingDependenciesErrors).should.equal(true, 'suppressMissingDependenciesErrors for ReferencedProject');

		projRef = project.databaseReferences.find(r => r instanceof SqlProjectReferenceProjectEntry && r.referenceName === 'OtherProject') as SqlProjectReferenceProjectEntry;
		should(projRef).not.equal(undefined, 'OtherProject reference');
		(projRef!.pathForSqlProj()).should.equal('..\\OtherProject\\OtherProject.sqlproj');
		(projRef!.projectGuid).should.equal('{C0DEBA11-BA5E-5EA7-ACE5-BABB1E70A575}');
		(projRef!.databaseVariableLiteralValue!).should.equal('OtherProjLiteral', 'databaseVariableLiteralValue for OtherProject');
		should(projRef!.databaseSqlCmdVariableName).equal(undefined);
		should(projRef!.databaseSqlCmdVariableValue).equal(undefined);
		should(projRef!.serverSqlCmdVariableName).equal(undefined);
		should(projRef!.serverSqlCmdVariableValue).equal(undefined);
		(projRef!.suppressMissingDependenciesErrors).should.equal(false, 'suppressMissingDependenciesErrors for OtherProject');

		let dacpacRef: DacpacReferenceProjectEntry | undefined = project.databaseReferences.find(r => r instanceof DacpacReferenceProjectEntry && r.referenceName === 'ReferencedDacpac') as DacpacReferenceProjectEntry;
		should(dacpacRef).not.equal(undefined, 'dacpac reference for ReferencedDacpac');
		(dacpacRef!.pathForSqlProj()).should.equal('..\\ReferencedDacpac\\ReferencedDacpac.dacpac');
		should(dacpacRef!.databaseVariableLiteralValue).equal(null, 'databaseVariableLiteralValue for ReferencedDacpac');
		(dacpacRef!.databaseSqlCmdVariableName!).should.equal('dacpacDbVar');
		(dacpacRef!.databaseSqlCmdVariableValue!).should.equal('$(SqlCmdVar__3)');
		(dacpacRef!.serverSqlCmdVariableName!).should.equal('dacpacServerVar');
		(dacpacRef!.serverSqlCmdVariableValue!).should.equal('$(SqlCmdVar__4)');
		(dacpacRef!.suppressMissingDependenciesErrors).should.equal(false, 'suppressMissingDependenciesErrors for ReferencedDacpac');

		dacpacRef = project.databaseReferences.find(r => r instanceof DacpacReferenceProjectEntry && r.referenceName === 'OtherDacpac') as DacpacReferenceProjectEntry;
		should(dacpacRef).not.equal(undefined, 'dacpac reference for OtherDacpac');
		(dacpacRef!.pathForSqlProj()).should.equal('..\\OtherDacpac\\OtherDacpac.dacpac');
		(dacpacRef!.databaseVariableLiteralValue!).should.equal('OtherDacpacLiteral', 'databaseVariableLiteralValue for OtherDacpac');
		should(dacpacRef!.databaseSqlCmdVariableName).equal(undefined);
		should(dacpacRef!.databaseSqlCmdVariableValue).equal(undefined);
		should(dacpacRef!.serverSqlCmdVariableName).equal(undefined);
		should(dacpacRef!.serverSqlCmdVariableValue).equal(undefined);
		(dacpacRef!.suppressMissingDependenciesErrors).should.equal(true, 'suppressMissingDependenciesErrors for OtherDacpac');
	});

	it('Should delete database references correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.databaseReferencesReadBaseline);
		const project = await Project.openProject(projFilePath);

		(project.databaseReferences.length).should.equal(5, 'There should be five database references');

		await project.deleteDatabaseReference(constants.msdb);
		(project.databaseReferences.length).should.equal(4, 'There should be four database references after deletion');

		let ref = project.databaseReferences.find(r => r.referenceName === constants.msdb);
		should(ref).equal(undefined, 'msdb reference should be deleted');
	});

	it('Should add system database artifact reference correctly', async function (): Promise<void> {
		let project = await testUtils.createTestSqlProject(this.test);

		const msdbRefSettings: ISystemDatabaseReferenceSettings = {
			databaseVariableLiteralValue: systemDatabaseToString(SystemDatabase.MSDB),
			systemDb: SystemDatabase.MSDB,
			suppressMissingDependenciesErrors: true,
			systemDbReferenceType: SystemDbReferenceType.ArtifactReference
		};
		await project.addSystemDatabaseReference(msdbRefSettings);

		(project.databaseReferences.length).should.equal(1, 'There should be one database reference after adding a reference to msdb');
		(project.databaseReferences[0].referenceName).should.equal(msdbRefSettings.databaseVariableLiteralValue, 'databaseName');
		(project.databaseReferences[0].suppressMissingDependenciesErrors).should.equal(msdbRefSettings.suppressMissingDependenciesErrors, 'suppressMissingDependenciesErrors');
		const projFileText = (await fs.readFile(project.projectFilePath)).toString();
		(projFileText).should.containEql('<ArtifactReference Include="$(SystemDacpacsLocation)');
	});

	it('Should add system database package reference correctly', async function (): Promise<void> {
		let project = await testUtils.createTestSqlProject(this.test);

		const msdbRefSettings: ISystemDatabaseReferenceSettings = {
			databaseVariableLiteralValue: systemDatabaseToString(SystemDatabase.MSDB),
			systemDb: SystemDatabase.MSDB,
			suppressMissingDependenciesErrors: true,
			systemDbReferenceType: SystemDbReferenceType.PackageReference
		};
		await project.addSystemDatabaseReference(msdbRefSettings);

		(project.databaseReferences.length).should.equal(1, 'There should be one database reference after adding a reference to msdb');
		(project.databaseReferences[0].referenceName).should.equal(msdbRefSettings.databaseVariableLiteralValue, 'databaseName');
		(project.databaseReferences[0].suppressMissingDependenciesErrors).should.equal(msdbRefSettings.suppressMissingDependenciesErrors, 'suppressMissingDependenciesErrors');
		const projFileText = (await fs.readFile(project.projectFilePath)).toString();
		(projFileText).should.containEql('Include="Microsoft.SqlServer.Dacpacs.Msdb">');
	});

	it('Should add a dacpac reference to the same database correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		let project = await Project.openProject(projFilePath);

		// add database reference in the same database
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		await project.addDatabaseReference({ dacpacFileLocation: Uri.file('test1.dacpac'), suppressMissingDependenciesErrors: true });

		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to test1');
		should(project.databaseReferences[0].referenceName).equal('test1', 'The database reference should be test1');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(true, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be true');
	});

	it('Should add a dacpac reference to a different database in the same server correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
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
		should(project.databaseReferences[0].referenceName).equal('test2', 'The database reference should be test2');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
	});

	it('Should add a dacpac reference to a different database in a different server correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
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
		should(project.databaseReferences[0].referenceName).equal('test3', 'The database reference should be test3');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
	});

	it('Should add a project reference to the same database correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		let project = await Project.openProject(projFilePath);

		// add database reference to the same database
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		should(project.sqlCmdVariables.size).equal(0, `There should be no sqlcmd variables to start with. Actual: ${project.sqlCmdVariables.size}`);
		await project.addProjectReference({
			projectName: 'project1',
			projectGuid: '',
			projectRelativePath: Uri.file(path.join('..', 'project1', 'project1.sqlproj')),
			suppressMissingDependenciesErrors: false
		});

		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to project1');
		should(project.databaseReferences[0].referenceName).equal('project1', 'The database reference should be project1');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		should(project.sqlCmdVariables.size).equal(0, `There should be no sqlcmd variables added. Actual: ${project.sqlCmdVariables.size}`);
	});

	it('Should add a project reference to a different database in the same server correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		let project = await Project.openProject(projFilePath);

		// add database reference to a different database on the same different server
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		should(project.sqlCmdVariables.size).equal(0, 'There should be no sqlcmd variables to start with');
		await project.addProjectReference({
			projectName: 'project1',
			projectGuid: '',
			projectRelativePath: Uri.file(path.join('..', 'project1', 'project1.sqlproj')),
			databaseName: 'testdbName',
			databaseVariable: 'testdb',
			suppressMissingDependenciesErrors: false
		});

		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to project1');
		should(project.databaseReferences[0].referenceName).equal('project1', 'The database reference should be project1');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		should(project.sqlCmdVariables.size).equal(1, `There should be one new sqlcmd variable added. Actual: ${project.sqlCmdVariables.size}`);
	});

	it('Should add a project reference to a different database in a different server correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		let project = await Project.openProject(projFilePath);

		// add database reference to a different database on a different server
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		should(project.sqlCmdVariables.size).equal(0, 'There should be no sqlcmd variables to start with');
		await project.addProjectReference({
			projectName: 'project1',
			projectGuid: '',
			projectRelativePath: Uri.file(path.join('..', 'project1', 'project1.sqlproj')),
			databaseName: 'testdbName',
			databaseVariable: 'testdb',
			serverName: 'otherServerName',
			serverVariable: 'otherServer',
			suppressMissingDependenciesErrors: false
		});

		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to project1');
		should(project.databaseReferences[0].referenceName).equal('project1', 'The database reference should be project1');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		should(project.sqlCmdVariables.size).equal(2, `There should be two new sqlcmd variables added. Actual: ${project.sqlCmdVariables.size}`);
	});

	it('Should add a nupkg reference to the same database correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newSdkStyleProjectSdkNodeBaseline);
		let project = await Project.openProject(projFilePath);

		// add database reference to the same database
		should(project.sqlProjStyle).equal(ProjectType.SdkStyle, 'Project should be SDK-style');
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		should(project.sqlCmdVariables.size).equal(0, `There should be no sqlcmd variables to start with. Actual: ${project.sqlCmdVariables.size}`);
		await project.addNugetPackageReference({
			packageName: 'testPackage',
			packageVersion: '1.0.1',
			suppressMissingDependenciesErrors: false
		});

		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to project1');
		should(project.databaseReferences[0].referenceName).equal('testPackage', 'The database reference should be project1');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		should(project.sqlCmdVariables.size).equal(0, `There should be no sqlcmd variables added. Actual: ${project.sqlCmdVariables.size}`);
	});

	it('Should add a nupkg reference to a different database in the same server correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newSdkStyleProjectSdkNodeBaseline);
		let project = await Project.openProject(projFilePath);

		// add database reference to a different database on the same different server
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		should(project.sqlCmdVariables.size).equal(0, 'There should be no sqlcmd variables to start with');
		await project.addNugetPackageReference({
			packageName: 'testPackage',
			packageVersion: '1.0.1',
			databaseName: 'testdbName',
			databaseVariable: 'testdb',
			suppressMissingDependenciesErrors: false
		});

		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to testPackage');
		should(project.databaseReferences[0].referenceName).equal('testPackage', 'The database reference should be testPackage');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		should(project.sqlCmdVariables.size).equal(1, `There should be one new sqlcmd variable added. Actual: ${project.sqlCmdVariables.size}`);
	});

	it('Should add a nupkg reference to a different database in a different server correctly', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newSdkStyleProjectSdkNodeBaseline);
		let project = await Project.openProject(projFilePath);

		// add database reference to a different database on a different server
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		should(project.sqlCmdVariables.size).equal(0, 'There should be no sqlcmd variables to start with');
		await project.addNugetPackageReference({
			packageName: 'testPackage',
			packageVersion: '1.0.1',
			databaseName: 'testdbName',
			databaseVariable: 'testdb',
			serverName: 'otherServerName',
			serverVariable: 'otherServer',
			suppressMissingDependenciesErrors: false
		});

		should(project.databaseReferences.length).equal(1, 'There should be a database reference after adding a reference to testPackage');
		should(project.databaseReferences[0].referenceName).equal('testPackage', 'The database reference should be testPackage');
		should(project.databaseReferences[0].suppressMissingDependenciesErrors).equal(false, 'project.databaseReferences[0].suppressMissingDependenciesErrors should be false');
		should(project.sqlCmdVariables.size).equal(2, `There should be two new sqlcmd variables added. Actual: ${project.sqlCmdVariables.size}`);
	});

	it('Should throw an error trying to add a nupkg reference to legacy style project', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		let project = await Project.openProject(projFilePath);

		// add database reference to the same database
		should(project.sqlProjStyle).equal(ProjectType.LegacyStyle, 'Project should be legacy-style');
		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');
		should(project.sqlCmdVariables.size).equal(0, `There should be no sqlcmd variables to start with. Actual: ${project.sqlCmdVariables.size}`);
		await testUtils.shouldThrowSpecificError(async () => await project.addNugetPackageReference({
			packageName: 'testPackage',
			packageVersion: '1.0.1',
			suppressMissingDependenciesErrors: false
		}),
			`Error adding database reference to testPackage. Error: Nuget package database references are not supported for the project ${project.projectFilePath}`
		);

		should(project.databaseReferences.length).equal(0, 'There should not have been any database reference added');
	});

	it('Should not allow adding duplicate dacpac references', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		let project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');

		const dacpacReference: IDacpacReferenceSettings = { dacpacFileLocation: Uri.file('test.dacpac'), suppressMissingDependenciesErrors: false };
		await project.addDatabaseReference(dacpacReference);

		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to test.dacpac');
		should(project.databaseReferences[0].referenceName).equal('test', 'project.databaseReferences[0].databaseName should be test');

		// try to add reference to test.dacpac again
		await testUtils.shouldThrowSpecificError(async () => await project.addDatabaseReference(dacpacReference), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after trying to add a reference to test.dacpac again');
	});

	it('Should not allow adding duplicate system database references', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		let project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');

		const systemDbReference: ISystemDatabaseReferenceSettings = {
			databaseVariableLiteralValue: systemDatabaseToString(SystemDatabase.Master),
			systemDb: SystemDatabase.Master,
			suppressMissingDependenciesErrors: false,
			systemDbReferenceType: SystemDbReferenceType.ArtifactReference
		};
		await project.addSystemDatabaseReference(systemDbReference);
		project = await Project.openProject(projFilePath);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to master');
		should(project.databaseReferences[0].referenceName).equal(constants.master, 'project.databaseReferences[0].databaseName should be master');

		// try to add reference to master again
		await testUtils.shouldThrowSpecificError(async () => await project.addSystemDatabaseReference(systemDbReference), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(1, 'There should only be one database reference after trying to add a reference to master again');
	});

	it('Should not allow adding duplicate project references', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		let project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');

		const projectReference: IProjectReferenceSettings = {
			projectName: 'testProject',
			projectGuid: '',
			projectRelativePath: Uri.file('testProject.sqlproj'),
			suppressMissingDependenciesErrors: false
		};
		await project.addProjectReference(projectReference);

		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to testProject.sqlproj');
		should(project.databaseReferences[0].referenceName).equal('testProject', 'project.databaseReferences[0].databaseName should be testProject');

		// try to add reference to testProject again
		await testUtils.shouldThrowSpecificError(async () => await project.addProjectReference(projectReference), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after trying to add a reference to testProject again');
	});

	it('Should not allow adding duplicate nupkg references', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newSdkStyleProjectSdkNodeBaseline);
		let project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');

		const nupkgReference: INugetPackageReferenceSettings = {
			packageName: 'testPackage',
			packageVersion: '1.0.0',
			suppressMissingDependenciesErrors: false
		};
		await project.addNugetPackageReference(nupkgReference);

		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to testPackage');
		should(project.databaseReferences[0].referenceName).equal('testPackage', 'project.databaseReferences[0].databaseName should be testPackage');

		// try to add reference to testPackage again
		await testUtils.shouldThrowSpecificError(async () => await project.addNugetPackageReference(nupkgReference), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after trying to add a reference to testPackage again');
	});

	it('Should handle trying to add duplicate database references when slashes are different direction', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		let project = await Project.openProject(projFilePath);

		should(project.databaseReferences.length).equal(0, 'There should be no database references to start with');

		const projectReference: IProjectReferenceSettings = {
			projectName: 'testProject',
			projectGuid: '',
			projectRelativePath: Uri.file('testFolder/testProject.sqlproj'),
			suppressMissingDependenciesErrors: false
		};
		await project.addProjectReference(projectReference);

		should(project.databaseReferences.length).equal(1, 'There should be one database reference after adding a reference to testProject.sqlproj');
		should(project.databaseReferences[0].referenceName).equal('testProject', 'project.databaseReferences[0].databaseName should be testProject');

		// try to add reference to testProject again with slashes in the other direction
		projectReference.projectRelativePath = Uri.file('testFolder\\testProject.sqlproj');
		await testUtils.shouldThrowSpecificError(async () => await project.addProjectReference(projectReference), constants.databaseReferenceAlreadyExists);
		should(project.databaseReferences.length).equal(1, 'There should be one database reference after trying to add a reference to testProject again');
	});

	it('Should update sqlcmd variable values if value changes', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
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
		should(project.databaseReferences[0].referenceName).equal('test3', 'The database reference should be test3');
		should(project.sqlCmdVariables.size).equal(2, 'There should be 2 sqlcmdvars after adding the dacpac reference');

		// make sure reference to test3.dacpac and SQLCMD variables were added
		let projFileText = (await fs.readFile(projFilePath)).toString();
		should(projFileText).containEql('<SqlCmdVariable Include="test3Db">');
		should(projFileText).containEql('<DefaultValue>test3DbName</DefaultValue>');
		should(projFileText).containEql('<SqlCmdVariable Include="otherServer">');
		should(projFileText).containEql('<DefaultValue>otherServerName</DefaultValue>');

		// delete reference
		await project.deleteDatabaseReferenceByEntry(project.databaseReferences[0]);
		should(project.databaseReferences.length).equal(0, 'There should be no database references after deleting');
		should(project.sqlCmdVariables.size).equal(2, 'There should still be 2 sqlcmdvars after deleting the dacpac reference');

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
		should(project.databaseReferences[0].referenceName).equal('test3', 'The database reference should be test3');
		should(project.sqlCmdVariables.size).equal(2, 'There should still be 2 sqlcmdvars after adding the dacpac reference again with different sqlcmdvar values');
	});
});

describe('Project: add SQLCMD Variables', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	after(async function (): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should update .sqlproj with new sqlcmd variables', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openProjectFileBaseline);
		let project = await Project.openProject(projFilePath);
		should(project.sqlCmdVariables.size).equal(2, 'The project should have 2 sqlcmd variables when opened');

		// add a new variable
		await project.addSqlCmdVariable('TestDatabaseName', 'TestDb');

		// update value of an existing sqlcmd variable
		await project.updateSqlCmdVariable('ProdDatabaseName', 'NewProdName');

		should(project.sqlCmdVariables.size).equal(3, 'There should be 3 sqlcmd variables after adding TestDatabaseName');
		should(project.sqlCmdVariables.get('TestDatabaseName')).equal('TestDb', 'Value of TestDatabaseName should be TestDb');
		should(project.sqlCmdVariables.get('ProdDatabaseName')).equal('NewProdName', 'ProdDatabaseName value should have been updated to the new value');
	});
});

describe('Project: publish profiles', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	after(async function (): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should add new publish profile', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openProjectFileBaseline);
		const project = await Project.openProject(projFilePath);
		should(project.publishProfiles.length).equal(3);

		// add a new publish profile
		const newProfilePath = path.join(project.projectFolderPath, 'TestProjectName_4.publish.xml');
		await fs.writeFile(newProfilePath, '<fake-publish-profile type="stage"/>');

		await project.addNoneItem('TestProjectName_4.publish.xml');

		should(project.publishProfiles.length).equal(4);
	});
});

describe('Project: properties', function (): void {
	before(async function (): Promise<void> {
		await baselines.loadBaselines();
	});

	after(async function (): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should read target database version', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.openProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.getProjectTargetVersion()).equal('150');
	});

	it('Should throw on missing target database version', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.sqlProjectMissingVersionBaseline);

		await testUtils.shouldThrowSpecificError(async () => await Project.openProject(projFilePath), 'Error: No target platform defined.  Missing <DSP> node.');
	});

	it('Should throw on invalid target database version', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.sqlProjectInvalidVersionBaseline);

		try {
			await Project.openProject(projFilePath);
			throw new Error('Should not have succeeded.');
		} catch (e) {
			(e.message).should.startWith('Error: Invalid value for Database Schema Provider:');
			(e.message).should.endWith('expected to be in the form \'Microsoft.Data.Tools.Schema.Sql.Sql160DatabaseSchemaProvider\'.');
		}
	});

	it('Should read default database collation', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.sqlProjectCustomCollationBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.getDatabaseDefaultCollation()).equal('SQL_Latin1_General_CP1255_CS_AS');
	});

	it('Should return default value when database collation is not specified', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.newProjectFileBaseline);
		const project = await Project.openProject(projFilePath);

		should(project.getDatabaseDefaultCollation()).equal('SQL_Latin1_General_CP1_CI_AS');
	});

	// TODO: skipped until DacFx throws on invalid value
	it.skip('Should throw on invalid default database collation', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.sqlProjectInvalidCollationBaseline);

		try {
			await Project.openProject(projFilePath);
			throw new Error('Should not have succeeded.');
		} catch (e) {
			(e.message).should.startWith('Error: Invalid value for DefaultCollation:');
		}
	});

	it('Should add database source to project property', async function (): Promise<void> {
		const project = await testUtils.createTestSqlProject(this.test);

		// Should add a single database source
		await project.addDatabaseSource('test1');
		let databaseSourceItems: string[] = project.getDatabaseSourceValues();
		should(databaseSourceItems.length).equal(1, 'number of database sources: ' + databaseSourceItems);
		should(databaseSourceItems[0]).equal('test1');

		// Should add multiple database sources
		await project.addDatabaseSource('test2');
		await project.addDatabaseSource('test3');
		databaseSourceItems = project.getDatabaseSourceValues();
		should(databaseSourceItems.length).equal(3, 'number of database sources: ' + databaseSourceItems);
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
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.sqlProjectInvalidCollationBaseline);
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

	it('Should throw error when adding or removing database source that contains semicolon', async function (): Promise<void> {
		const projFilePath = await testUtils.createTestSqlProjFile(this.test, baselines.sqlProjectInvalidCollationBaseline);
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

	after(async function (): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should update SSDT project to work in ADS', async function (): Promise<void> {
		await testUpdateInRoundTrip(this.test, baselines.SSDTProjectFileBaseline);
	});

	it.skip('Should update SSDT project with new system database references', async function (): Promise<void> {
		await testUpdateInRoundTrip(this.test, baselines.SSDTUpdatedProjectBaseline);
	});

	it('Should update SSDT project to work in ADS handling pre-existing targets', async function (): Promise<void> {
		await testUpdateInRoundTrip(this.test, baselines.SSDTProjectBaselineWithBeforeBuildTarget);
	});

	it('Should not update project and no backup file should be created when prompt to update project is rejected', async function (): Promise<void> {
		sinon.stub(window, 'showWarningMessage').returns(<any>Promise.resolve(constants.noString));
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath(this.test);
		const sqlProjPath = await testUtils.createTestSqlProjFile(this.test, baselines.SSDTProjectFileBaseline, folderPath);

		const originalSqlProjContents = (await fs.readFile(sqlProjPath)).toString();

		// validate original state
		let project = await Project.openProject(sqlProjPath, false);
		(project.isCrossPlatformCompatible).should.be.false('SSDT project should not be cross-platform compatible when not prompted to update');

		// validate rejection result
		project = await Project.openProject(sqlProjPath, true);
		(project.isCrossPlatformCompatible).should.be.false('SSDT project should not be cross-platform compatible when update prompt is rejected');
		(await exists(sqlProjPath + '_backup')).should.be.false('backup file should not be generated');

		const newSqlProjContents = (await fs.readFile(sqlProjPath)).toString();
		newSqlProjContents.should.equal(originalSqlProjContents, 'SSDT .sqlproj contents should not have changed when update prompt is rejected')

		sinon.restore();
	});

	it('Should not show warning message for non-SSDT projects that have the additional information for Build', async function (): Promise<void> {
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath(this.test);
		const sqlProjPath = await testUtils.createTestSqlProjFile(this.test, baselines.openProjectFileBaseline, folderPath);
		await testUtils.createTestDataSources(this.test, baselines.openDataSourcesBaseline, folderPath);

		await Project.openProject(Uri.file(sqlProjPath).fsPath); // no error thrown
	});

	it('Should not show update project warning message when opening sdk style project using Sdk node', async function (): Promise<void> {
		await shouldNotShowUpdateWarning(this.test, baselines.newSdkStyleProjectSdkNodeBaseline);
	});

	it('Should not show update project warning message when opening sdk style project using Project node with Sdk attribute', async function (): Promise<void> {
		await shouldNotShowUpdateWarning(this.test, baselines.newSdkStyleProjectSdkProjectAttributeBaseline);
	});

	it('Should not show update project warning message when opening sdk style project using Import node with Sdk attribute', async function (): Promise<void> {
		await shouldNotShowUpdateWarning(this.test, baselines.newStyleProjectSdkImportAttributeBaseline);
	});

	async function shouldNotShowUpdateWarning(test: Mocha.Runnable | undefined, baselineFile: string): Promise<void> {
		// setup test files
		const folderPath = await testUtils.generateTestFolderPath(test);
		const sqlProjPath = await testUtils.createTestSqlProjFile(test, baselineFile, folderPath);
		const spy = sinon.spy(window, 'showWarningMessage');

		const project = await Project.openProject(Uri.file(sqlProjPath).fsPath);
		(project.isCrossPlatformCompatible).should.be.true('Project should be detected as cross-plat compatible');
		(spy.notCalled).should.be.true('Prompt to update .sqlproj should not have been shown for cross-plat project.');
	}
});

async function testUpdateInRoundTrip(test: Mocha.Runnable | undefined, fileBeforeupdate: string): Promise<void> {
	const projFilePath = await testUtils.createTestSqlProjFile(test, fileBeforeupdate);
	const project = await Project.openProject(projFilePath); // project gets updated if needed in openProject()
	should(project.isCrossPlatformCompatible).be.false('Project should not be cross-plat compatible before conversion');

	project.isCrossPlatformCompatible.should.be.false('Project should not be cross-plat compatible before conversion');

	await project.updateProjectForCrossPlatform();

	(project.isCrossPlatformCompatible).should.be.true('Project should be cross-plat compatible after conversion');
	(await exists(projFilePath + '_backup')).should.be.true('Backup file should have been generated before the project was updated');

	sinon.restore();
}

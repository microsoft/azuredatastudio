/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as vscode from 'vscode';
import * as baselines from '../baselines/baselines';
import * as templates from '../../templates/templates';
import * as testUtils from '../testUtils';
import * as TypeMoq from 'typemoq';

import { PublishDatabaseDialog } from '../../dialogs/publishDatabaseDialog';
import { Project } from '../../models/project';
import { ProjectsController } from '../../controllers/projectController';
import { emptySqlDatabaseProjectTypeId } from '../../common/constants';
import { createContext, mockDacFxOptionsResult, TestContext } from '../testContext';
import { IPublishToDockerSettings, ISqlProjectPublishSettings } from '../../models/deploy/publishSettings';

let testContext: TestContext;
describe('Publish Database Dialog', () => {
	before(async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
		testContext = createContext();
	});

	after(async function (): Promise<void> {
		await testUtils.deleteGeneratedTestFolder();
	});

	it('Should open dialog successfully ', async function (): Promise<void> {
		const projController = new ProjectsController(testContext.outputChannel);
		const projFileDir = await testUtils.generateTestFolderPath(this.test);

		const projFilePath = await projController.createNewProject({
			newProjName: 'TestProjectName',
			folderUri: vscode.Uri.file(projFileDir),
			projectTypeId: emptySqlDatabaseProjectTypeId,
			configureDefaultBuild: true,
			projectGuid: 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575',
			sdkStyle: false
		});

		const project = await Project.openProject(projFilePath);
		const publishDatabaseDialog = new PublishDatabaseDialog(project);
		publishDatabaseDialog.openDialog();
		should.notEqual(publishDatabaseDialog.publishTab, undefined);
	});

	it('Should create default database name correctly ', async function (): Promise<void> {
		const projController = new ProjectsController(testContext.outputChannel);
		const projFileDir = await testUtils.generateTestFolderPath(this.test);

		const projFilePath = await projController.createNewProject({
			newProjName: 'TestProjectName',
			folderUri: vscode.Uri.file(projFileDir),
			projectTypeId: emptySqlDatabaseProjectTypeId,
			configureDefaultBuild: true,
			projectGuid: 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575',
			sdkStyle: false
		});

		const project = new Project(projFilePath);

		const publishDatabaseDialog = new PublishDatabaseDialog(project);
		should.equal(publishDatabaseDialog.getDefaultDatabaseName(), project.projectFileName);
	});

	it('Should include all info in publish profile', async function (): Promise<void> {
		const proj = await testUtils.createTestProject(this.test, baselines.openProjectFileBaseline);
		const dialog = TypeMoq.Mock.ofType(PublishDatabaseDialog, undefined, undefined, proj);
		dialog.setup(x => x.getConnectionUri()).returns(() => { return Promise.resolve('Mock|Connection|Uri'); });
		dialog.setup(x => x.targetDatabaseName).returns(() => 'MockDatabaseName');
		dialog.setup(x => x.getSqlCmdVariablesForPublish()).returns(() => proj.sqlCmdVariables);
		dialog.setup(x => x.getDeploymentOptions()).returns(() => { return Promise.resolve(mockDacFxOptionsResult.deploymentOptions); });
		dialog.setup(x => x.getServerName()).returns(() => 'MockServer');
		dialog.object.publishToExistingServer = true;
		dialog.callBase = true;

		let profile: ISqlProjectPublishSettings | undefined;

		const expectedPublish: ISqlProjectPublishSettings = {
			databaseName: 'MockDatabaseName',
			serverName: 'MockServer',
			connectionUri: 'Mock|Connection|Uri',
			sqlCmdVariables: new Map([
				['ProdDatabaseName', 'MyProdDatabase'],
				['BackupDatabaseName', 'MyBackupDatabase']
			]),
			deploymentOptions: mockDacFxOptionsResult.deploymentOptions,
			publishProfileUri: undefined
		};

		dialog.object.publish = (_, prof) => { profile = prof; };
		await dialog.object.publishClick();

		should(profile).deepEqual(expectedPublish);

		const expectedGenScript: ISqlProjectPublishSettings = {
			databaseName: 'MockDatabaseName',
			serverName: 'MockServer',
			connectionUri: 'Mock|Connection|Uri',
			sqlCmdVariables: new Map([
				['ProdDatabaseName', 'MyProdDatabase'],
				['BackupDatabaseName', 'MyBackupDatabase']
			]),
			deploymentOptions: mockDacFxOptionsResult.deploymentOptions,
			publishProfileUri: undefined
		};

		dialog.object.generateScript = (_, prof) => { profile = prof; };
		await dialog.object.generateScriptClick();

		should(profile).deepEqual(expectedGenScript);

		const expectedContainerPublishProfile: IPublishToDockerSettings = {
			dockerSettings: {
				dbName: 'MockDatabaseName',
				dockerBaseImage: 'mcr.microsoft.com/mssql/server',
				password: '',
				port: 1433,
				serverName: 'localhost',
				userName: 'sa',
				dockerBaseImageEula: 'https://aka.ms/mcr/osslegalnotice'

			},
			sqlProjectPublishSettings: {
				databaseName: 'MockDatabaseName',
				serverName: 'localhost',
				connectionUri: '',
				sqlCmdVariables: new Map([
					['ProdDatabaseName', 'MyProdDatabase'],
					['BackupDatabaseName', 'MyBackupDatabase']
				]),
				deploymentOptions: mockDacFxOptionsResult.deploymentOptions,
				publishProfileUri: undefined
			}
		};
		dialog.object.publishToExistingServer = false;
		let deployProfile: IPublishToDockerSettings | undefined;
		dialog.object.publishToContainer = (_, prof) => { deployProfile = prof; };
		await dialog.object.publishClick();

		should(deployProfile).deepEqual(expectedContainerPublishProfile);
	});
});

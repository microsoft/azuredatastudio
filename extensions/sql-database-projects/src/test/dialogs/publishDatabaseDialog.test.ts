/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as baselines from '../baselines/baselines';
import * as templates from '../../templates/templates';
import * as testUtils from '../testUtils';
import * as TypeMoq from 'typemoq';

import { PublishDatabaseDialog } from '../../dialogs/publishDatabaseDialog';
import { Project } from '../../models/project';
import { ProjectsController } from '../../controllers/projectController';
import { IDeploySettings } from '../../models/IDeploySettings';
import { emptySqlDatabaseProjectTypeId } from '../../common/constants';
import { createContext, mockDacFxOptionsResult, TestContext } from '../testContext';

let testContext: TestContext;
describe('Publish Database Dialog', () => {
	before(async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
		testContext = createContext();
	});

	it('Should open dialog successfully ', async function (): Promise<void> {
		const projController = new ProjectsController(testContext.outputChannel);
		const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

		const projFilePath = await projController.createNewProject({
			newProjName: 'TestProjectName',
			folderUri: vscode.Uri.file(projFileDir),
			projectTypeId: emptySqlDatabaseProjectTypeId,
			projectGuid: 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575'
		});

		const project = new Project(projFilePath);
		const publishDatabaseDialog = new PublishDatabaseDialog(project);
		publishDatabaseDialog.openDialog();
		should.notEqual(publishDatabaseDialog.publishTab, undefined);
	});

	it('Should create default database name correctly ', async function (): Promise<void> {
		const projController = new ProjectsController(testContext.outputChannel);
		const projFolder = `TestProject_${new Date().getTime()}`;
		const projFileDir = path.join(os.tmpdir(), projFolder);

		const projFilePath = await projController.createNewProject({
			newProjName: 'TestProjectName',
			folderUri: vscode.Uri.file(projFileDir),
			projectTypeId: emptySqlDatabaseProjectTypeId,
			projectGuid: 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575'
		});

		const project = new Project(projFilePath);

		const publishDatabaseDialog = new PublishDatabaseDialog(project);
		should.equal(publishDatabaseDialog.getDefaultDatabaseName(), project.projectFileName);
	});

	it('Should include all info in publish profile', async function (): Promise<void> {
		const proj = await testUtils.createTestProject(baselines.openProjectFileBaseline);
		const dialog = TypeMoq.Mock.ofType(PublishDatabaseDialog, undefined, undefined, proj);
		dialog.setup(x => x.getConnectionUri()).returns(() => { return Promise.resolve('Mock|Connection|Uri'); });
		dialog.setup(x => x.getTargetDatabaseName()).returns(() => 'MockDatabaseName');
		dialog.setup(x => x.getSqlCmdVariablesForPublish()).returns(() => proj.sqlCmdVariables);
		dialog.setup(x => x.getDeploymentOptions()).returns(() => { return Promise.resolve(mockDacFxOptionsResult.deploymentOptions); });
		dialog.setup(x => x.getServerName()).returns(() => 'MockServer');
		dialog.callBase = true;

		let profile: IDeploySettings | undefined;

		const expectedPublish: IDeploySettings = {
			databaseName: 'MockDatabaseName',
			serverName: 'MockServer',
			connectionUri: 'Mock|Connection|Uri',
			sqlCmdVariables: {
				'ProdDatabaseName': 'MyProdDatabase',
				'BackupDatabaseName': 'MyBackupDatabase'
			},
			deploymentOptions: mockDacFxOptionsResult.deploymentOptions,
			profileUsed: false
		};

		dialog.object.publish = (_, prof) => { profile = prof; };
		await dialog.object.publishClick();

		should(profile).deepEqual(expectedPublish);

		const expectedGenScript: IDeploySettings = {
			databaseName: 'MockDatabaseName',
			serverName: 'MockServer',
			connectionUri: 'Mock|Connection|Uri',
			sqlCmdVariables: {
				'ProdDatabaseName': 'MyProdDatabase',
				'BackupDatabaseName': 'MyBackupDatabase'
			},
			deploymentOptions: mockDacFxOptionsResult.deploymentOptions,
			profileUsed: false
		};

		dialog.object.generateScript = (_, prof) => { profile = prof; };
		await dialog.object.generateScriptClick();

		should(profile).deepEqual(expectedGenScript);
	});
});

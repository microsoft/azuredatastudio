/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';
import * as testUtils from './testUtils';
import * as TypeMoq from 'typemoq';

import { PublishDatabaseDialog } from '../dialogs/publishDatabaseDialog';
import { Project } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { IPublishSettings, IGenerateScriptSettings } from '../models/IPublishSettings';

describe.skip('Publish Database Dialog', () => {
	before(async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	it('Should open dialog successfully ', async function (): Promise<void> {
		const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
		const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

		const projFilePath = await projController.createNewProject('TestProjectName', vscode.Uri.file(projFileDir), true, 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575');
		const project = new Project(projFilePath);
		const publishDatabaseDialog = new PublishDatabaseDialog(project);
		publishDatabaseDialog.openDialog();
		should.notEqual(publishDatabaseDialog.publishTab, undefined);
	});

	it('Should create default database name correctly ', async function (): Promise<void> {
		const projController = new ProjectsController(new SqlDatabaseProjectTreeViewProvider());
		const projFolder = `TestProject_${new Date().getTime()}`;
		const projFileDir = path.join(os.tmpdir(), projFolder);

		const projFilePath = await projController.createNewProject('TestProjectName', vscode.Uri.file(projFileDir), true, 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575');
		const project = new Project(projFilePath);

		const publishDatabaseDialog = new PublishDatabaseDialog(project);
		should.equal(publishDatabaseDialog.getDefaultDatabaseName(), project.projectFileName);
	});

	it('Should include all info in publish profile', async function (): Promise<void> {
		const proj = await testUtils.createTestProject(baselines.openProjectFileBaseline);
		const dialog = TypeMoq.Mock.ofType(PublishDatabaseDialog, undefined, undefined, proj);
		dialog.setup(x => x.getConnectionUri()).returns(() => { return Promise.resolve('Mock|Connection|Uri'); });
		dialog.setup(x => x.getTargetDatabaseName()).returns(() => 'MockDatabaseName');
		dialog.callBase = true;

		let profile: IPublishSettings | IGenerateScriptSettings | undefined;

		const expectedPublish: IPublishSettings  = {
			databaseName: 'MockDatabaseName',
			connectionUri: 'Mock|Connection|Uri',
			upgradeExisting: true,
			sqlCmdVariables: {
				'ProdDatabaseName': 'MyProdDatabase',
				'BackupDatabaseName': 'MyBackupDatabase'
			}
		};

		dialog.object.publish = (_, prof) => { profile = prof; };
		await dialog.object.publishClick();

		should(profile).deepEqual(expectedPublish);

		const expectedGenScript: IGenerateScriptSettings = {
			databaseName: 'MockDatabaseName',
			connectionUri: 'Mock|Connection|Uri',
			sqlCmdVariables: {
				'ProdDatabaseName': 'MyProdDatabase',
				'BackupDatabaseName': 'MyBackupDatabase'
			}
		};

		dialog.object.generateScript = (_, prof) => { profile = prof; };
		await dialog.object.generateScriptClick();

		should(profile).deepEqual(expectedGenScript);
	});
});

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
import * as testUtils from '../test/testUtils';

import { DeployDatabaseDialog } from '../dialogs/deployDatabaseDialog';
import { Project } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { createContext, TestContext } from './testContext';
import { IDeploymentProfile, IGenerateScriptProfile } from '../models/IDeploymentProfile';


let testContext: TestContext;

describe('Deploy Database Dialog', () => {
	before(async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	beforeEach(async function (): Promise<void> {
		testContext = createContext();
	});

	it('Should open dialog successfully ', async function (): Promise<void> {
		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

		const projFilePath = await projController.createNewProject('TestProjectName', vscode.Uri.file(projFileDir), 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575');
		const project = new Project(projFilePath);
		const deployDatabaseDialog = new DeployDatabaseDialog(testContext.apiWrapper.object, project);
		deployDatabaseDialog.openDialog();
		should.notEqual(deployDatabaseDialog.deployTab, undefined);
	});

	it('Should create default database name correctly ', async function (): Promise<void> {
		const projController = new ProjectsController(testContext.apiWrapper.object, new SqlDatabaseProjectTreeViewProvider());
		const projFolder = `TestProject_${new Date().getTime()}`;
		const projFileDir = path.join(os.tmpdir(), projFolder);

		const projFilePath = await projController.createNewProject('TestProjectName', vscode.Uri.file(projFileDir), 'BA5EBA11-C0DE-5EA7-ACED-BABB1E70A575');
		const project = new Project(projFilePath);

		const deployDatabaseDialog = new DeployDatabaseDialog(testContext.apiWrapper.object, project);
		should.equal(deployDatabaseDialog.getDefaultDatabaseName(), project.projectFileName);
	});

	it('Should include all info in deployment profile', async function (): Promise<void> {
		const proj = await testUtils.createTestProject(baselines.openProjectFileBaseline);
		const dialog = new DeployDatabaseDialog(testContext.apiWrapper.object, proj);
		let profile: IDeploymentProfile | IGenerateScriptProfile | undefined;

		dialog.deploy = async (_, prof) => { profile = prof; };
		dialog.deployClick();

		should(profile).equal(undefined);

		dialog.generateScript = async (_, prof) => { profile = prof; };
		dialog.generateScriptClick();

		should(profile).equal(undefined);
	});
});

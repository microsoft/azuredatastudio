/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';
import * as constants from '../common/constants';
import { createContext, TestContext } from './testContext';
import MainController from '../controllers/mainController';
import { generateTestFolderPath, createTestProject } from './testUtils';

let testContext: TestContext;

describe('MainController: main controller operations', function (): void {
	before(async function (): Promise<void> {
		testContext = createContext();
		await templates.loadTemplates(path.join(__dirname, '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should create new project through MainController', async function (): Promise<void> {
		const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

		sinon.stub(vscode.window, 'showInputBox').resolves('MyProjectName');
		sinon.stub(vscode.window, 'showOpenDialog').resolves([vscode.Uri.file(projFileDir)]);
		sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => undefined);

		const controller = new MainController(testContext.context);
		const proj = await controller.createNewProject();

		should(proj).not.equal(undefined);
	});

	it('Should show error when no project name', async function (): Promise<void> {
		for (const name of ['', '    ', undefined]) {
			const stub = sinon.stub(vscode.window, 'showInputBox').resolves(name);
			const spy = sinon.spy(vscode.window, 'showErrorMessage');
			const controller = new MainController(testContext.context);
			await controller.createNewProject();
			should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once');
			should(spy.calledWith(constants.projectNameRequired)).be.true(`showErrorMessage not called with expected message '${constants.projectNameRequired}' Actual '${spy.getCall(0).args[0]}'`);
			stub.restore();
			spy.restore();
		}
	});

	it('Should show error when no location name', async function (): Promise<void> {
		sinon.stub(vscode.window, 'showInputBox').resolves('MyProjectName');
		sinon.stub(vscode.window, 'showOpenDialog').resolves(undefined);
		const spy = sinon.spy(vscode.window, 'showErrorMessage');
		const controller = new MainController(testContext.context);
		await controller.createNewProject();
		should(spy.calledOnce).be.true('showErrorMessage should be called exactly once');
		should(spy.calledWith(constants.projectLocationRequired)).be.true(`showErrorMessage not called with expected message '${constants.projectLocationRequired}' Actual '${spy.getCall(0).args[0]}'`);
	});

	it('Should create new instance without error', async function (): Promise<void> {
		should.doesNotThrow(() => new MainController(testContext.context), 'Creating controller should not throw an error');
	});

	it('Should activate and deactivate without error', async function (): Promise<void> {
		let controller = new MainController(testContext.context);
		should.notEqual(controller.extensionContext, undefined);

		should.doesNotThrow(() => controller.activate(), 'activate() should not throw an error');
		should.doesNotThrow(() => controller.dispose(), 'dispose() should not throw an error');
	});

	it('Should load projects in workspace', async function (): Promise<void> {
		const rootFolderPath = await generateTestFolderPath();
		const project = await createTestProject(baselines.openProjectFileBaseline, rootFolderPath);
		const nestedFolder = path.join(rootFolderPath, 'nestedProject');
		const nestedProject = await createTestProject(baselines.openProjectFileBaseline, nestedFolder);

		const workspaceFolder: vscode.WorkspaceFolder = {
			uri: vscode.Uri.file(rootFolderPath),
			name: '',
			index: 0
		};
		sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => [workspaceFolder]);

		const controller = new MainController(testContext.context);
		should(controller.projController.projects.length).equal(0);

		await controller.loadProjectsInWorkspace();

		should(controller.projController.projects.length).equal(2);
		should(controller.projController.projects[0].projectFolderPath).equal(project.projectFolderPath);
		should(controller.projController.projects[1].projectFolderPath).equal(nestedProject.projectFolderPath);
	});
});

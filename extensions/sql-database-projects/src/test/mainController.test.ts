/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';
import * as constants from '../common/constants';

import { createContext, TestContext } from './testContext';
import MainController from '../controllers/mainController';
import { shouldThrowSpecificError } from './testUtils';

let testContext: TestContext;

describe('MainController: main controller operations', function (): void {
	before(async function (): Promise<void> {
		testContext = createContext();
		await templates.loadTemplates(path.join(__dirname, '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	beforeEach(function (): void {
		testContext.apiWrapper.reset();
	});

	it('Should create new project through MainController', async function (): Promise<void> {
		const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('MyProjectName'));
		testContext.apiWrapper.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve([vscode.Uri.file(projFileDir)]));
		testContext.apiWrapper.setup(x => x.workspaceFolders()).returns(() => undefined);
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => {
			console.log(s);
			return Promise.resolve(s);
		});

		const controller = new MainController(testContext.context, testContext.apiWrapper.object);
		const proj = await controller.createNewProject();

		should(proj).not.equal(undefined);
	});

	it('Should show error when no project name', async function (): Promise<void> {
		for (const name of ['', '    ', undefined]) {
			testContext.apiWrapper.reset();
			testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(name));
			testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

			const controller = new MainController(testContext.context, testContext.apiWrapper.object);
			await shouldThrowSpecificError(async () => await controller.createNewProject(), constants.projectNameRequired, `case: '${name}'`);
		}
	});

	it('Should show error when no location name', async function (): Promise<void> {
		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('MyProjectName'));
		testContext.apiWrapper.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		const controller = new MainController(testContext.context, testContext.apiWrapper.object);
		await shouldThrowSpecificError(async () => await controller.createNewProject(), constants.projectLocationRequired);
	});

	it('Should create new instance without error', async function (): Promise<void> {
		should.doesNotThrow(() => new MainController(testContext.context, testContext.apiWrapper.object), 'Creating controller should not throw an error');
	});

	it('Should activate and deactivate without error', async function (): Promise<void> {
		let controller = new MainController(testContext.context, testContext.apiWrapper.object);
		should.notEqual(controller.extensionContext, undefined);

		should.doesNotThrow(() => controller.activate(), 'activate() should not throw an error');
		should.doesNotThrow(() => controller.dispose(), 'dispose() should not throw an error');
	});
});

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

import { createContext, TestContext } from './testContext';
import MainController from '../controllers/mainController';

let testContext: TestContext;

describe('MainController: main controller operations', function (): void {
	before(async function (): Promise<void> {
		testContext = createContext();
		await templates.loadTemplates(path.join(__dirname, '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	beforeEach(async function (): Promise<void> {
		testContext.apiWrapper.reset();
	});

	it('Should create new sqlproj file with correct values', async function (): Promise<void> {
		const projFileDir = path.join(os.tmpdir(), `TestProject_${new Date().getTime()}`);

		testContext.apiWrapper.setup(x => x.showInputBox(TypeMoq.It.isAny())).returns(() => Promise.resolve('MyProjectName'));
		testContext.apiWrapper.setup(x => x.showOpenDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve([vscode.Uri.file(projFileDir)]));

		const controller = new MainController(testContext.context, testContext.apiWrapper.object);

		const proj = await controller.createNewProject();

		console.log(proj);
		should(proj).not.equal(undefined);
	});
});

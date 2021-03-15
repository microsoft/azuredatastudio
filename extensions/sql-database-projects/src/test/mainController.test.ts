/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as sinon from 'sinon';
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

	afterEach(function (): void {
		sinon.restore();
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
});

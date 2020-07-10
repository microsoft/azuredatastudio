/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import { createContext, TestContext } from './testContext';
import MainController from '../controllers/mainController';

let testContext: TestContext;

function createController(): MainController {
	let controller = new MainController(testContext.context, testContext.apiWrapper.object);
	return controller;
}

describe('MainController: main controller operations', function (): void {
	before(async function (): Promise<void> {
		testContext = createContext();
	});

	it('Should create new instance, activate, and deactivate successfully', async function (): Promise<void> {
		let controller: MainController;
		should.doesNotThrow(() => controller = createController(), 'Creating controller should not throw an error');
		should.notEqual(controller.extensionContext, undefined);

		should.doesNotThrow(() => controller.dispose(), 'dispose() should not throw an error');
	});
});

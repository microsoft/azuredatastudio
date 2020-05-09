/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as should from 'should';
import MainController from '../controllers/mainController';
import { TestContext, createContext } from './testContext';

let testContext: TestContext;

function createController(): MainController {
	let controller = new MainController(testContext.context);
	return controller;
}

describe('MainController', function (): void {
	before(async function (): Promise<void> {
		testContext = createContext();
	});

	it('Should create new instance successfully', async function (): Promise<void> {
		let controller: MainController;
		should.doesNotThrow(() => controller = createController());
		should.notEqual(controller.extensionContext, undefined);
	});

});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import MainController from '../../controllers/mainController';
import { ImportTestUtils, TestExtensionContext } from '../utils.test';
import * as should from 'should';

describe('Main Controller', function () {
	let testExtensionContext: TestExtensionContext;

	beforeEach(async function () {
		// creating a mock Extension Context with current extensionPath
		testExtensionContext = await ImportTestUtils.getTestExtensionContext();
	});

	it('Should register task flatFileImportStartCommand after activate is called', async function () {
		let mainController = new MainController(testExtensionContext);
		should.doesNotThrow(() => mainController.activate());
	});
});


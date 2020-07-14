/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import MainController from '../../controllers/mainController';
import * as constants from '../../common/constants';
import * as sinon from 'sinon';
import { ImportTestUtils, TestExtensionContext } from '../utils.test';

describe('Main Controller', function () {
	let testExtensionContext: TestExtensionContext;
	let registerTaskSpy: sinon.SinonSpy;

	beforeEach(async function () {
		// creating a mock Extension Context with current extensionPath
		testExtensionContext = await ImportTestUtils.getTestExtensionContext();
		registerTaskSpy = sinon.spy(azdata.tasks, 'registerTask');
	});

	it('Should download required binaries and register flatFileImportStartCommand after activate is called', async function () {

		let mainController = new MainController(testExtensionContext);

		await mainController.activate();

		// verifying that the task is registered.
		sinon.assert.calledOnceWithExactly(registerTaskSpy, constants.flatFileImportStartCommand);

	});
});


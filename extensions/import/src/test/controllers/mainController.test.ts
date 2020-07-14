/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';
import MainController from '../../controllers/mainController';
import * as constants from '../../common/constants';
import { ImportTestUtils, TestExtensionContext } from '../utils.test';

describe('Main Controller', function () {
	let testExtensionContext: TestExtensionContext;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;

	beforeEach(async function () {
		// creating a mock Extension Context with current extensionPath
		testExtensionContext = await ImportTestUtils.getTestExtensionContext();
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
	});

	it('Should register task flatFileImportStartCommand after activate is called', async function () {

		// using vscode and azdata APIs available during tests
		mockApiWrapper.callBase = true;

		let mainController = new MainController(testExtensionContext, mockApiWrapper.object);

		await mainController.activate();

		// verifying that the task is registered.
		mockApiWrapper.verify(x => x.registerTask(constants.flatFileImportStartCommand, TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});


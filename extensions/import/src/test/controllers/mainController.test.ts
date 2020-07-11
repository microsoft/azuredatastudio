/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';
import MainController from '../../controllers/mainController';
import * as constants from '../../common/constants';
import * as should from 'should';
import * as path from 'path';
import { ImportTestUtils, TestExtensionContext } from '../utils.test';

describe('Main Controller', function () {
	let testExtensionContext: TestExtensionContext;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	let extensionPath: string;

	beforeEach(async function () {
		extensionPath = await ImportTestUtils.getExtensionPath();
		// creating a mock Extension Context with current extensionPath
		testExtensionContext = await ImportTestUtils.getTestExtensionContext();
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
	});

	it('Should download required binaries and register flatFileImportStartCommand after activate is called', async function () {
		this.timeout(50000);


		// using vscode and azdata APIs available during tests
		mockApiWrapper.callBase = true;

		let mainController = new MainController(testExtensionContext, mockApiWrapper.object);

		await mainController.activate();

		// verifying that the task is registered.
		mockApiWrapper.verify(x => x.registerTask(constants.flatFileImportStartCommand, TypeMoq.It.isAny()), TypeMoq.Times.once());

		//Checking if .net code files are downloaded
		should.equal(await ImportTestUtils.checkPathExists(path.join(extensionPath, 'flatfileimportservice')), true);
	});
});


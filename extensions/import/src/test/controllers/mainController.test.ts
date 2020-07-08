/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';
import MainController from '../../controllers/mainController';
import * as constants from '../../common/constants';
import { TestExtensionContext } from '../utils.test';

describe('Main Controller', function () {
	let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	// path of the root directory of the extension from the test file
	const extensionPath = __dirname + '../../../../';

	this.beforeEach(function () {
		mockExtensionContext = TypeMoq.Mock.ofType(TestExtensionContext, TypeMoq.MockBehavior.Loose, true, extensionPath);
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
	});

	it('Should create new instance successfully', async function () {
		// mocking createOutputChannel in API wrapper
		mockApiWrapper.setup(x => x.createOutputChannel(TypeMoq.It.isAny()));

		// creating a Main Controller
		new MainController(mockExtensionContext.object, mockApiWrapper.object);

		// verifying if the output channel is created
		mockApiWrapper.verify(x => x.createOutputChannel(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Should resgister flatFileImportStartCommand after activate is called', async function(){
		// using vscode and azdata APIs available during tests
		mockApiWrapper.callBase = true;

		// creating an instance of the Main Controller
		let mainController = new MainController(mockExtensionContext.object, mockApiWrapper.object);

		// calling the activate function
		await mainController.activate();

		// verifying that the command is registered.
		mockApiWrapper.verify(x => x.registerTask(constants.flatFileImportStartCommand, TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});


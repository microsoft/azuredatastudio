/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';
import MainController from '../../controllers/mainController';
import { TestExtensionContext } from '../utils.test';

describe('Main Controller', function () {
	let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;

	this.beforeEach(function () {
		mockExtensionContext = TypeMoq.Mock.ofType(TestExtensionContext, TypeMoq.MockBehavior.Loose);
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
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';
import MainController from '../../controllers/mainController';
import * as constants from '../../common/constants';
import { TestExtensionContext, getExtensionPath } from '../utils.test';
import * as fs from 'fs';
import * as should from 'should';
import * as path from 'path';

describe('Main Controller', function () {
	let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	let extensionPath: string;
	let flatFileImportServicePath: string;

	beforeEach(async function () {
		extensionPath = await getExtensionPath();
		flatFileImportServicePath = path.join(await getExtensionPath(), 'flatfileimportservice');
		// creating a mock Extension Context with current extensionPath
		mockExtensionContext = TypeMoq.Mock.ofType(TestExtensionContext, TypeMoq.MockBehavior.Loose, true, extensionPath);
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
	});

	it('Should download required binaries and register flatFileImportStartCommand after activate is called', async function () {
		this.timeout(50000);

		// deleting .net code files to check if activate downloads it again.
		if(await checkPathExists(flatFileImportServicePath)){
			await fs.promises.rmdir(flatFileImportServicePath);
		}
		should.equal(await checkPathExists(flatFileImportServicePath), false);

		// using vscode and azdata APIs available during tests
		mockApiWrapper.callBase = true;

		let mainController = new MainController(mockExtensionContext.object, mockApiWrapper.object);

		await mainController.activate();

		// verifying that the task is registered.
		mockApiWrapper.verify(x => x.registerTask(constants.flatFileImportStartCommand, TypeMoq.It.isAny()), TypeMoq.Times.once());

		//Checking if .net code files are downloaded
		should.equal(await checkPathExists(flatFileImportServicePath), true);
	});
});


async function checkPathExists(path: string): Promise<boolean> {
	return fs.promises.access(path, fs.constants.F_OK)
		.then(() => true)
		.catch(() => false);
}


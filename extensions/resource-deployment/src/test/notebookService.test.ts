/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as TypeMoq from 'typemoq';
import 'mocha';
import { NotebookService } from '../services/NotebookService';
import assert = require('assert');
import { NotebookInfo } from '../interfaces';
import { IPlatformService } from '../services/platformService';

suite('Notebook Service Tests', function (): void {

	test('getNotebook with string parameter', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const notebookService = new NotebookService(mockPlatformService.object);
		const notebookInput = 'test-notebook.ipynb';
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'win32'; });
		let returnValue = notebookService.getNotebook(notebookInput);
		assert.equal(returnValue, notebookInput, 'returned notebook name does not match expected value');
		mockPlatformService.verify((service) => service.platform(), TypeMoq.Times.never());

		mockPlatformService.reset();
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'win32'; });
		returnValue = notebookService.getNotebook('');
		assert.equal(returnValue, '', 'returned notebook name does not match expected value is not an empty string');
		mockPlatformService.verify((service) => service.platform(), TypeMoq.Times.never());
	});

	test('getNotebook with NotebookInfo parameter', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const notebookService = new NotebookService(mockPlatformService.object);
		const notebookWin32 = 'test-notebook-win32.ipynb';
		const notebookDarwin = 'test-notebook-darwin.ipynb';
		const notebookLinux = 'test-notebook-linux.ipynb';

		const notebookInput: NotebookInfo = {
			darwin: notebookDarwin,
			win32: notebookWin32,
			linux: notebookLinux
		};
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'win32'; });
		let returnValue = notebookService.getNotebook(notebookInput);
		assert.equal(returnValue, notebookWin32, 'returned notebook name does not match expected value for win32 platform');
		mockPlatformService.verify((service) => service.platform(), TypeMoq.Times.once());

		mockPlatformService.reset();
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'darwin'; });
		returnValue = notebookService.getNotebook(notebookInput);
		assert.equal(returnValue, notebookDarwin, 'returned notebook name does not match expected value for darwin platform');
		mockPlatformService.verify((service) => service.platform(), TypeMoq.Times.once());

		mockPlatformService.reset();
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'linux'; });
		returnValue = notebookService.getNotebook(notebookInput);
		assert.equal(returnValue, notebookLinux, 'returned notebook name does not match expected value for linux platform');
		mockPlatformService.verify((service) => service.platform(), TypeMoq.Times.once());
	});

});
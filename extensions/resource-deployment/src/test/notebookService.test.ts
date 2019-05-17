/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import { NotebookService } from '../services/NotebookService';
import assert = require('assert');
import { NotebookInfo } from '../interfaces';

describe('Notebook Service Tests', function (): void {

	it('notebook parameter is a string', () => {
		const notebookService = new NotebookService();
		const notebookInput = 'test-notebook.ipynb';
		let returnValue = notebookService.getNotebook(notebookInput, () => 'win32');
		assert(returnValue === notebookInput, 'returned notebook name does not match expected value for win32 platform');

		returnValue = notebookService.getNotebook(notebookInput, () => 'darwin');
		assert(returnValue === notebookInput, 'returned notebook name does not match expected value for darwin platform');

		returnValue = notebookService.getNotebook(notebookInput, () => 'linux');
		assert(returnValue === notebookInput, 'returned notebook name does not match expected value for linux platform');
	});

	it('notebook parameter is a NotebookInfo', () => {
		const notebookService = new NotebookService();
		const notebookWin32 = 'test-notebook-win32.ipynb';
		const notebookDarwin = 'test-notebook-darwin.ipynb';
		const notebookLinux = 'test-notebook-linux.ipynb';

		const notebookInput: NotebookInfo = {
			darwin: notebookDarwin,
			win32: notebookWin32,
			linux: notebookLinux
		};
		let returnValue = notebookService.getNotebook(notebookInput, () => 'win32');
		assert(returnValue === notebookWin32, 'returned notebook name does not match expected value for win32 platform');

		returnValue = notebookService.getNotebook(notebookInput, () => 'darwin');
		assert(returnValue === notebookDarwin, 'returned notebook name does not match expected value for darwin platform');

		returnValue = notebookService.getNotebook(notebookInput, () => 'linux');
		assert(returnValue === notebookLinux, 'returned notebook name does not match expected value for linux platform');
	});
});
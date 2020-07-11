/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import 'mocha';
import { NotebookService } from '../services/notebookService';
import assert = require('assert');
import { NotebookPathInfo } from '../interfaces';
import { IPlatformService } from '../services/platformService';

suite('Notebook Service Tests', function (): void {

	test('getNotebook with string parameter', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const notebookService = new NotebookService(mockPlatformService.object, '');
		const notebookInput = 'test-notebook.ipynb';
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'win32'; });
		let returnValue = notebookService.getNotebookPath(notebookInput);
		assert.equal(returnValue, notebookInput, 'returned notebook name does not match expected value');
		mockPlatformService.verify((service) => service.platform(), TypeMoq.Times.never());

		mockPlatformService.reset();
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'win32'; });
		returnValue = notebookService.getNotebookPath('');
		assert.equal(returnValue, '', 'returned notebook name does not match expected value is not an empty string');
		mockPlatformService.verify((service) => service.platform(), TypeMoq.Times.never());
	});

	test('getNotebook with NotebookInfo parameter', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const notebookService = new NotebookService(mockPlatformService.object, '');
		const notebookWin32 = 'test-notebook-win32.ipynb';
		const notebookDarwin = 'test-notebook-darwin.ipynb';
		const notebookLinux = 'test-notebook-linux.ipynb';

		const notebookInput: NotebookPathInfo = {
			darwin: notebookDarwin,
			win32: notebookWin32,
			linux: notebookLinux
		};
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'win32'; });
		let returnValue = notebookService.getNotebookPath(notebookInput);
		assert.equal(returnValue, notebookWin32, 'returned notebook name does not match expected value for win32 platform');
		mockPlatformService.verify((service) => service.platform(), TypeMoq.Times.once());

		mockPlatformService.reset();
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'darwin'; });
		returnValue = notebookService.getNotebookPath(notebookInput);
		assert.equal(returnValue, notebookDarwin, 'returned notebook name does not match expected value for darwin platform');
		mockPlatformService.verify((service) => service.platform(), TypeMoq.Times.once());

		mockPlatformService.reset();
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'linux'; });
		returnValue = notebookService.getNotebookPath(notebookInput);
		assert.equal(returnValue, notebookLinux, 'returned notebook name does not match expected value for linux platform');
		mockPlatformService.verify((service) => service.platform(), TypeMoq.Times.once());
	});

	test('findNextUntitledEditorName with no name conflict', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const notebookService = new NotebookService(mockPlatformService.object, '');
		const notebookFileName = 'mynotebook.ipynb';
		const sourceNotebookPath = `./notebooks/${notebookFileName}`;

		const expectedTargetFile = 'mynotebook';
		mockPlatformService.setup((service) => service.isNotebookNameUsed(TypeMoq.It.isAnyString()))
			.returns((path) => { return false; });
		const actualFileName = notebookService.findNextUntitledEditorName(sourceNotebookPath);
		mockPlatformService.verify((service) => service.isNotebookNameUsed(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		assert.equal(actualFileName, expectedTargetFile, 'target file name is not correct');
	});

	test('findNextUntitledEditorName with name conflicts', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const notebookService = new NotebookService(mockPlatformService.object, '');
		const notebookFileName = 'mynotebook.ipynb';
		const sourceNotebookPath = `./notebooks/${notebookFileName}`;
		const expectedFileName = 'mynotebook-2';

		const expected1stAttemptTargetFile = 'mynotebook';
		const expected2ndAttemptTargetFile = 'mynotebook-1';
		mockPlatformService.setup((service) => service.isNotebookNameUsed(TypeMoq.It.isAnyString()))
			.returns((path) => {
				// list all the possible values here and handle them
				// if we only handle the expected value and return true for anything else, the test might run forever until times out
				if (path === expected1stAttemptTargetFile || path === expected2ndAttemptTargetFile) {
					return true;
				}
				return false;
			});
		const actualFileName = notebookService.findNextUntitledEditorName(sourceNotebookPath);
		mockPlatformService.verify((service) => service.isNotebookNameUsed(TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(3));
		assert.equal(actualFileName, expectedFileName, 'target file name is not correct');
	});
});

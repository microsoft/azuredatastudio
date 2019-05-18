/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as TypeMoq from 'typemoq';
import 'mocha';
import * as path from 'path';
import * as os from 'os';
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

	test('launchNotebook', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const notebookService = new NotebookService(mockPlatformService.object);
		const notebookFileName = 'mynotebook.ipynb';
		const notebookPath = `./notebooks/${notebookFileName}`;

		let actualSourceFile;
		const expectedSourceFile = path.join(__dirname, '../../', notebookPath);
		let actualTargetFile;
		const expectedTargetFile = path.join(os.homedir(), notebookFileName);
		mockPlatformService.setup((service) => service.platform()).returns(() => { return 'win32'; });
		mockPlatformService.setup((service) => service.openFile(TypeMoq.It.isAnyString()));
		mockPlatformService.setup((service) => service.fileExists(TypeMoq.It.isAnyString()))
			.returns((path) => {
				if (path === expectedSourceFile) {
					return true;
				}
				return false;
			});
		mockPlatformService.setup((service) => service.copyFile(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
			.returns((source, target) => { actualSourceFile = source; actualTargetFile = target; });
		notebookService.launchNotebook(notebookPath);
		mockPlatformService.verify((service) => service.copyFile(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		mockPlatformService.verify((service) => service.openFile(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		assert.equal(actualSourceFile, expectedSourceFile, 'source file is not correct');
		assert.equal(actualTargetFile, expectedTargetFile, 'target file is not correct');
	});

	test('getTargetNotebookFileName with no name conflict', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const notebookService = new NotebookService(mockPlatformService.object);
		const notebookFileName = 'mynotebook.ipynb';
		const sourceNotebookPath = `./notebooks/${notebookFileName}`;

		const expectedTargetFile = path.join(os.homedir(), notebookFileName);
		mockPlatformService.setup((service) => service.fileExists(TypeMoq.It.isAnyString()))
			.returns((path) => { return false; });
		const actualFileName = notebookService.getTargetNotebookFileName(sourceNotebookPath, os.homedir());
		mockPlatformService.verify((service) => service.fileExists(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		assert.equal(actualFileName, expectedTargetFile, 'target file name is not correct');
	});

	test('getTargetNotebookFileName with name conflicts', () => {
		const mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		const notebookService = new NotebookService(mockPlatformService.object);
		const notebookFileName = 'mynotebook.ipynb';
		const sourceNotebookPath = `./notebooks/${notebookFileName}`;
		const expectedFileName = 'mynotebook-2.ipynb';

		const expected1stAttemptTargetFile = path.join(os.homedir(), notebookFileName);
		const expected2ndAttemptTargetFile = path.join(os.homedir(), 'mynotebook-1.ipynb');
		const expectedTargetFile = path.join(os.homedir(), expectedFileName);
		mockPlatformService.setup((service) => service.fileExists(TypeMoq.It.isAnyString()))
			.returns((path) => {
				// list all the possible values here and handle them
				// if we only handle the expected value and return true for anything else, the test might run forever until times out
				if (path === expected1stAttemptTargetFile || path === expected2ndAttemptTargetFile) {
					return true;
				}
				return false;
			});
		const actualFileName = notebookService.getTargetNotebookFileName(sourceNotebookPath, os.homedir());
		mockPlatformService.verify((service) => service.fileExists(TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(3));
		assert.equal(actualFileName, expectedTargetFile, 'target file name is not correct');
	});
});
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import 'mocha';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { NotebookPathInfo } from '../../interfaces';
import { NotebookService } from '../../services/notebookService';
import { IPlatformService } from '../../services/platformService';
import assert = require('assert');


describe('NotebookService', function (): void {
	const notebookInput = 'test-notebook.ipynb';
	const notebookFileName = 'mynotebook.ipynb';
	const expectedTargetFileName = 'mynotebook';
	const sourceNotebookPath = `./notebooks/${notebookFileName}`;
	const notebookWin32 = 'test-notebook-win32.ipynb';
	const notebookDarwin = 'test-notebook-darwin.ipynb';
	const notebookLinux = 'test-notebook-linux.ipynb';
	let mockPlatformService: TypeMoq.IMock<IPlatformService>, notebookService: NotebookService;

	beforeEach('Notebook Service Setup', () => {
		mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>();
		notebookService = new NotebookService(mockPlatformService.object, '');
	});

	it('getNotebook with string parameter', () => {
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

	it('getNotebook with NotebookInfo parameter', () => {
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

	it('findNextUntitledEditorName with no name conflict', () => {
		mockPlatformService.setup((service) => service.isNotebookNameUsed(TypeMoq.It.isAnyString()))
			.returns((path) => { return false; });
		const actualFileName = notebookService.findNextUntitledEditorName(sourceNotebookPath);
		mockPlatformService.verify((service) => service.isNotebookNameUsed(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		assert.equal(actualFileName, expectedTargetFileName, 'target file name is not correct');
	});

	it('findNextUntitledEditorName with name conflicts', () => {
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

	it('showNotebookAsUntitled', async () => {
		const documentContent = 'documentContent';
		sinon.stub(vscode.workspace, 'openTextDocument').resolves(<vscode.TextDocument>{ getText: () => documentContent });
		const stub = sinon.stub(azdata.nb, 'showNotebookDocument').resolves();
		await notebookService.showNotebookAsUntitled(sourceNotebookPath);
		stub.callCount.should.equal(1);
		const untitledFileName = stub.getCall(0).args[0]!;
		untitledFileName.scheme.should.equal('untitled');
		untitledFileName.path.should.equal(expectedTargetFileName);
		const options = stub.getCall(0).args[1]!;
		options.initialContent!.should.equal(documentContent);
	});
});

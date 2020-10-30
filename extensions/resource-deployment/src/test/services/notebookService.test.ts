/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import 'mocha';
import * as path from 'path';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { NotebookPathInfo } from '../../interfaces';
import { Notebook, NotebookService } from '../../services/notebookService';
import { IPlatformService, PlatformService } from '../../services/platformService';
import * as loc from '../../localizedConstants';
import assert = require('assert');

describe('NotebookService', function (): void {
	const notebookInput = 'test-notebook.ipynb';
	const sourceNotebookContent = 'documentContent';
	const notebookFileName = 'mynotebook.ipynb';
	const expectedTargetFileName = 'mynotebook';
	const extensionPath = path.resolve(__dirname, '..', '..', '..');
	const sourceNotebookRelativePath = `./notebooks/${notebookFileName}`;
	const sourceNotebookAbsolutePath = path.resolve(extensionPath, sourceNotebookRelativePath);
	const notebookWin32 = 'test-notebook-win32.ipynb';
	const notebookDarwin = 'test-notebook-darwin.ipynb';
	const notebookLinux = 'test-notebook-linux.ipynb';
	const storagePath = __dirname;
	let mockPlatformService: TypeMoq.IMock<IPlatformService>, notebookService: NotebookService;

	beforeEach('NotebookService Setup', () => {
		mockPlatformService = TypeMoq.Mock.ofType<IPlatformService>(PlatformService, TypeMoq.MockBehavior.Loose);
		notebookService = new NotebookService(mockPlatformService.object, extensionPath);
	});

	afterEach('NotebookService cleanup', () => {
		sinon.restore();
		mockPlatformService.reset();
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
		const actualFileName = notebookService.findNextUntitledEditorName(sourceNotebookRelativePath);
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
		const actualFileName = notebookService.findNextUntitledEditorName(sourceNotebookRelativePath);
		mockPlatformService.verify((service) => service.isNotebookNameUsed(TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(3));
		assert.equal(actualFileName, expectedFileName, 'target file name is not correct');
	});

	it('showNotebookAsUntitled', async () => {
		const { showNotebookStub } = showNotebookSetup(sourceNotebookContent);
		await notebookService.showNotebookAsUntitled(sourceNotebookRelativePath);
		showNotebookVerify(showNotebookStub, expectedTargetFileName, sourceNotebookContent);
	});

	describe('openNotebook', () => {
		beforeEach('openNotebook setup', () => {
			mockPlatformService.setup(x => x.fileExists(sourceNotebookAbsolutePath)).returns(async () => true); // fileExists returns true when called with sourceNotebookAbsolutePath
			mockPlatformService.setup(x => x.fileExists(TypeMoq.It.isAnyString())).returns(async () => false); // fileExists returns false when called with any other string
		});
		[sourceNotebookRelativePath, sourceNotebookAbsolutePath].forEach((notebookPath) => {
			it(`notebookPath: ${notebookPath}`, async () => {
				const { showNotebookStub } = showNotebookSetup(sourceNotebookContent);
				await notebookService.openNotebook(notebookPath);
				showNotebookVerify(showNotebookStub, expectedTargetFileName, sourceNotebookContent);
			});
		});
	});

	it('openNotebookWithEdits', async () => {
		mockPlatformService.setup(x => x.fileExists(sourceNotebookAbsolutePath)).returns(async () => true); // fileExists returns true when called with sourceNotebookAbsolutePath
		const editorBuilder = <azdata.nb.NotebookEditorEdit>{
			insertCell(value: azdata.nb.ICellContents, index?: number, collapsed?: boolean): void { }
		};
		const editorBuilderStub = sinon.stub(editorBuilder, 'insertCell').returns();
		const { showNotebookStub, notebookEditorStub } = showNotebookSetup(sourceNotebookContent, editorBuilder);
		const cellStatements: string[] = [];
		await notebookService.openNotebookWithEdits(sourceNotebookAbsolutePath, cellStatements);
		notebookEditorStub.callCount.should.equal(1);
		editorBuilderStub.callCount.should.equal(1);
		const valueInserted = editorBuilderStub.getCall(0).args[0];
		valueInserted.cell_type.should.equal('code');
		valueInserted.source.should.equal(cellStatements);
		const insertionPosition = editorBuilderStub.getCall(0).args[1];
		should(insertionPosition).be.equal(0); //default insertionPosition is 0.
		showNotebookVerify(showNotebookStub, expectedTargetFileName, sourceNotebookContent);
	});

	it('openNotebookWithContent', async () => {
		const title = 'title';
		const { showNotebookStub } = showNotebookSetup(sourceNotebookContent);
		await notebookService.openNotebookWithContent(title, sourceNotebookContent);
		showNotebookVerify(showNotebookStub, undefined, sourceNotebookContent);
	});

	describe('executeNotebook', () => {
		it('success', async () => {
			executeNotebookSetup(mockPlatformService, storagePath);
			const result = await notebookService.executeNotebook(<Notebook>{}, process.env);
			result.succeeded.should.be.true();
		});
		it('fails', async () => {
			const errorMessage = 'errorMessage';
			executeNotebookSetup(mockPlatformService, storagePath, errorMessage, sourceNotebookContent);
			const result = await notebookService.executeNotebook(<Notebook>{}, process.env);
			result.succeeded.should.be.false();
			result.outputNotebook!.should.equal(sourceNotebookContent);
			result.errorMessage!.should.equal(errorMessage);
		});
	});

	describe('backgroundExecuteNotebook', () => {
		const taskName = 'taskName';
		it('success', async () => {
			executeNotebookSetup(mockPlatformService, storagePath);
			const stub = sinon.stub(azdata.tasks, 'startBackgroundOperation').callThrough();
			notebookService.backgroundExecuteNotebook(taskName, <Notebook>{ cells: [] }, 'deploy'/*tempNotebookPrefix*/, mockPlatformService.object, process.env);
			verifyBackgroundExecuteNotebookStub(stub, taskName);
		});
		[false, true].forEach(outputProduced => {
			it(`fails, with outputGenerated = ${outputProduced}`, async () => {
				const errorMessage = 'errorMessage';
				executeNotebookSetup(mockPlatformService, storagePath, errorMessage, outputProduced ? sourceNotebookContent : '');
				sinon.stub(azdata.nb, 'showNotebookDocument').rejects(new Error(errorMessage));
				sinon.stub(vscode.window, 'showErrorMessage').callsFake(async (message, ...items) => {
					if (outputProduced) {
						if (items?.length === 1) {
							message.should.equal(loc.backgroundExecutionFailed(taskName));
							return <any>loc.viewErrorDetail;
						} else {
							message.should.equal(loc.failedToOpenNotebook(errorMessage))
						}
					} else {
						message.should.equal(loc.taskFailedWithNoOutputNotebook(errorMessage));
					}
				});
				notebookService.backgroundExecuteNotebook(taskName, <Notebook>{ cells: [] }, 'deploy'/*tempNotebookPrefix*/, mockPlatformService.object, process.env);
			});
		});

	});
});

function verifyBackgroundExecuteNotebookStub(stub: sinon.SinonStub, taskName: string) {
	const operationInfo = stub.getCall(0).args[0];
	stub.callCount.should.equal(1);
	operationInfo.displayName.should.equal(taskName);
	operationInfo.description.should.equal(taskName);
	should(operationInfo.operation).not.be.undefined();
	operationInfo.isCancelable.should.be.false();
}

function executeNotebookSetup(mockPlatformService: TypeMoq.IMock<IPlatformService>, storagePath: string, errorMessage?: string, sourceNotebookContent?: string) {
	mockPlatformService.setup(x => x.storagePath()).returns(() => storagePath);
	mockPlatformService.setup(x => x.saveTextFile(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()));
	if (errorMessage) {
		mockPlatformService.setup(x => x.runCommand(
			TypeMoq.It.is((s: string) => s.startsWith('azdata notebook run')),
			TypeMoq.It.isAny()
		)).throws(new Error(errorMessage));
	} else {
		mockPlatformService.setup(x => x.runCommand(
			TypeMoq.It.is((s: string) => s.startsWith('azdata notebook run')),
			TypeMoq.It.isAny()
		)).returns(async () => 'success');
	}
	mockPlatformService.setup(x => x.deleteFile(TypeMoq.It.is((s: string) => path.dirname(s) === storagePath && path.basename(s).startsWith('nb-'))))
		.returns(async () => { }); // match deletion of executed notebookPath
	mockPlatformService.setup(x => x.deleteFile(TypeMoq.It.is((s: string) => path.dirname(s) === storagePath && path.basename(s).startsWith('output-nb-'))))
		.returns(async () => { }); // match deletion of output of executed notebookPath
	if (errorMessage) {
		mockPlatformService.setup(x => x.fileExists(TypeMoq.It.is((s: string) => path.dirname(s) === storagePath && path.basename(s).startsWith('output-nb-'))))
			.returns(async () => true);
		mockPlatformService.setup(x => x.readTextFile(TypeMoq.It.is((s: string) => path.dirname(s) === storagePath && path.basename(s).startsWith('output-nb-'))))
			.returns(async () => sourceNotebookContent!);
	}
}

function showNotebookVerify(stub: sinon.SinonStub, expectedTargetFileName: string | undefined, sourceNotebookContent: string) {
	stub.callCount.should.equal(1);
	const untitledFileName = stub.getCall(0).args[0]!;
	untitledFileName.scheme.should.equal('untitled');
	if (expectedTargetFileName) {
		untitledFileName.path.should.equal(expectedTargetFileName);
	}
	const options = stub.getCall(0).args[1]!;
	options.initialContent!.should.equal(sourceNotebookContent);
}

function showNotebookSetup(sourceNotebookContent: string, editorBuilder?: azdata.nb.NotebookEditorEdit) {
	sinon.stub(vscode.workspace, 'openTextDocument').resolves(<vscode.TextDocument>{ getText: () => sourceNotebookContent });
	const nbEditor = <azdata.nb.NotebookEditor>{
		edit(callback: (editBuilder: azdata.nb.NotebookEditorEdit) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean; }): Thenable<boolean> {
			return Promise.resolve(true);
		}
	};
	const notebookEditorStub = sinon.stub(nbEditor, 'edit').callsFake(async callback => {
		if (editorBuilder) {
			callback(editorBuilder);
		}
		return true;
	});
	const showNotebookStub = sinon.stub(azdata.nb, 'showNotebookDocument').resolves(nbEditor);
	return { showNotebookStub, notebookEditorStub };
}

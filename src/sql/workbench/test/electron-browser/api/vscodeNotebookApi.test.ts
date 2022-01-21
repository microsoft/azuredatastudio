/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { convertToVSCodeCellOutput, VSCodeContentManager, convertToADSCellOutput } from 'sql/workbench/api/common/vscodeSerializationProvider';
import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import * as sinon from 'sinon';
import { NotebookCellKind } from 'vs/workbench/api/common/extHostTypes';
import { VSBuffer } from 'vs/base/common/buffer';
import * as assert from 'assert';
import { OutputTypes } from 'sql/workbench/services/notebook/common/contracts';
import { NBFORMAT, NBFORMAT_MINOR } from 'sql/workbench/common/constants';
import { convertToVSCodeNotebookCell } from 'sql/workbench/api/common/vscodeExecuteProvider';
import { VSCodeNotebookDocument } from 'sql/workbench/api/common/vscodeNotebookDocument';
import { URI } from 'vs/base/common/uri';

class MockNotebookSerializer implements vscode.NotebookSerializer {
	deserializeNotebook(content: Uint8Array, token: vscode.CancellationToken): vscode.NotebookData | Thenable<vscode.NotebookData> {
		return undefined;
	}
	serializeNotebook(data: vscode.NotebookData, token: vscode.CancellationToken): Uint8Array | Thenable<Uint8Array> {
		return new Uint8Array([]);
	}
}

suite('Notebook Serializer', () => {
	let contentManager: VSCodeContentManager;
	let sandbox: sinon.SinonSandbox;
	let serializeSpy: sinon.SinonSpy;

	const deserializeResult: vscode.NotebookData = {
		cells: [{
			kind: NotebookCellKind.Code,
			value: '1+1',
			languageId: 'python',
			outputs: [{
				id: '1',
				items: [{
					mime: 'text/plain',
					data: VSBuffer.fromString('2').buffer
				}],
				metadata: {}
			}],
			executionSummary: {
				executionOrder: 1
			}
		}, {
			kind: NotebookCellKind.Code,
			value: 'print(1)',
			languageId: 'python',
			outputs: [{
				id: '2',
				items: [{
					mime: 'text/plain',
					data: VSBuffer.fromString('1').buffer
				}],
				metadata: {}
			}],
			executionSummary: {
				executionOrder: 2
			}
		}],
		metadata: {
			kernelspec: {
				name: 'python3',
				display_name: 'Python 3',
				language: 'python'
			},
			language_info: {
				name: 'python',
				version: '3.8.10',
				mimetype: 'text/x-python',
				codemirror_mode: {
					name: 'ipython',
					version: '3'
				}
			},
			custom: {
				nbformat: NBFORMAT,
				nbformat_minor: NBFORMAT_MINOR
			}
		},
	};

	const expectedDeserializedNotebook: azdata.nb.INotebookContents = {
		metadata: {
			kernelspec: {
				name: 'python3',
				display_name: 'Python 3',
				language: 'python'
			},
			language_info: {
				name: 'python',
				version: '3.8.10',
				mimetype: 'text/x-python',
				codemirror_mode: {
					name: 'ipython',
					version: '3'
				}
			}
		},
		nbformat: NBFORMAT,
		nbformat_minor: NBFORMAT_MINOR,
		cells: [
			{
				cell_type: 'code',
				source: '1+1',
				outputs: [
					{
						id: '1',
						output_type: 'execute_result',
						data: {
							'text/plain': '2'
						},
						metadata: {},
						execution_count: 1
					} as azdata.nb.IExecuteResult
				],
				execution_count: 1,
				metadata: {
					language: 'python'
				}
			},
			{
				cell_type: 'code',
				source: 'print(1)',
				outputs: [
					{
						id: '2',
						output_type: 'execute_result',
						data: {
							'text/plain': '1'
						},
						metadata: {},
						execution_count: 2
					} as azdata.nb.IExecuteResult
				],
				execution_count: 2,
				metadata: {
					language: 'python'
				}
			}
		]
	};

	const expectedSerializeArg: vscode.NotebookData = {
		cells: [{
			kind: NotebookCellKind.Code,
			value: '1+1',
			languageId: 'python',
			outputs: [{
				items: [{
					mime: 'text/plain',
					data: VSBuffer.fromString('2').buffer
				}],
				metadata: {},
				id: '1'
			}],
			executionSummary: {
				executionOrder: 1
			}
		}, {
			kind: NotebookCellKind.Code,
			value: 'print(1)',
			languageId: 'python',
			outputs: [{
				items: [{
					mime: 'text/plain',
					data: VSBuffer.fromString('1').buffer
				}],
				metadata: {},
				id: '2'
			}],
			executionSummary: {
				executionOrder: 2
			}
		}],
		metadata: {
			kernelspec: {
				name: 'python3',
				display_name: 'Python 3',
				language: 'python'
			},
			language_info: {
				name: 'python',
				version: '3.8.10',
				mimetype: 'text/x-python',
				codemirror_mode: {
					name: 'ipython',
					version: '3'
				}
			},
			custom: {
				nbformat: NBFORMAT,
				nbformat_minor: NBFORMAT_MINOR
			}
		}
	};

	setup(() => {
		sandbox = sinon.createSandbox();
		let serializer = new MockNotebookSerializer();
		sandbox.stub(serializer, 'deserializeNotebook').returns(deserializeResult);
		serializeSpy = sandbox.spy(serializer, 'serializeNotebook');

		contentManager = new VSCodeContentManager(serializer);
	});

	teardown(() => {
		sandbox.restore();
	});


	test('Convert VSCode notebook output to ADS notebook output', async () => {
		let cellOutput: vscode.NotebookCellOutput = {
			items: [{
				mime: 'text/plain',
				data: VSBuffer.fromString('2').buffer
			}, {
				mime: 'text/html',
				data: VSBuffer.fromString('<i>2</i>').buffer
			}],
			metadata: {},
			id: '1'
		};
		let expectedADSOutput: azdata.nb.IExecuteResult[] = [
			{
				id: '1',
				output_type: 'execute_result',
				data: {
					'text/plain': '2',
					'text/html': '<i>2</i>'
				},
				metadata: {},
				execution_count: 1
			}
		];

		let actualOutput = convertToADSCellOutput(cellOutput, 1);
		assert.deepStrictEqual(actualOutput, expectedADSOutput);
	});

	test('Convert ADS notebook execute result to VSCode notebook output', async () => {
		let cellOutput: azdata.nb.IExecuteResult = {
			id: 'testId',
			output_type: OutputTypes.ExecuteResult,
			data: {
				'text/plain': 'abc',
				'text/html': '<i>abc</i>'
			},
			execution_count: 1
		};
		let expectedVSCodeOutput: vscode.NotebookCellOutput = {
			items: [{
				mime: 'text/plain',
				data: VSBuffer.fromString('abc').buffer
			}, {
				mime: 'text/html',
				data: VSBuffer.fromString('<i>abc</i>').buffer
			}],
			id: 'testId',
			metadata: undefined
		};
		let actualOutput = convertToVSCodeCellOutput(cellOutput);
		assert.deepStrictEqual(actualOutput, expectedVSCodeOutput);
	});

	test('Convert ADS notebook stream result to VSCode notebook output', async () => {
		let cellOutput: azdata.nb.IStreamResult = {
			id: 'testId',
			output_type: 'stream',
			name: 'stdout',
			text: [
				'abc'
			]
		};
		let expectedVSCodeOutput: vscode.NotebookCellOutput = {
			items: [{
				mime: 'text/html',
				data: VSBuffer.fromString('abc').buffer
			}],
			id: 'testId',
			metadata: undefined
		};
		let actualOutput = convertToVSCodeCellOutput(cellOutput);
		assert.deepStrictEqual(actualOutput, expectedVSCodeOutput);
	});

	test('Convert ADS notebook error with trace to VSCode notebook output', async () => {
		let cellOutput: azdata.nb.IErrorResult = {
			id: 'testId',
			output_type: 'error',
			ename: 'TestException',
			evalue: 'Expected test error',
			traceback: ['Trace line 1', 'Trace line 2']
		};
		let expectedVSCodeOutput: vscode.NotebookCellOutput = {
			items: [{
				mime: 'text/html',
				data: VSBuffer.fromString('TestException: Expected test error\nTrace line 1\nTrace line 2').buffer
			}],
			id: 'testId',
			metadata: undefined
		};
		let actualOutput = convertToVSCodeCellOutput(cellOutput);
		assert.deepStrictEqual(actualOutput, expectedVSCodeOutput);
	});

	test('Convert ADS notebook error without trace to VSCode notebook output', async () => {
		let cellOutput: azdata.nb.IErrorResult = {
			id: 'testId',
			output_type: 'error',
			ename: 'TestException',
			evalue: 'Expected test error'
		};
		let expectedVSCodeOutput: vscode.NotebookCellOutput = {
			items: [{
				mime: 'text/html',
				data: VSBuffer.fromString('TestException: Expected test error').buffer
			}],
			id: 'testId',
			metadata: undefined
		};
		let actualOutput = convertToVSCodeCellOutput(cellOutput);
		assert.deepStrictEqual(actualOutput, expectedVSCodeOutput);
	});

	test('Deserialize VSCode notebook into ADS notebook data', async () => {
		let output = await contentManager.deserializeNotebook(''); // Argument is ignored since we're returning a mocked result
		assert.deepStrictEqual(output, expectedDeserializedNotebook);
	});

	test('Serialize ADS notebook data into VSCode notebook strings', async () => {
		await contentManager.serializeNotebook(expectedDeserializedNotebook); // Argument is ignored since we're returning a mocked result
		assert(serializeSpy.calledOnce);
		assert.deepStrictEqual(serializeSpy.firstCall.args[0], expectedSerializeArg);
	});

	const testDoc: azdata.nb.NotebookDocument = {
		uri: URI.parse('untitled:a/b/c/testNotebook.ipynb'),
		fileName: 'testFile',
		providerId: 'testProvider',
		isUntitled: true,
		isDirty: true,
		isClosed: false,
		cells: [{
			contents: {
				cell_type: 'code',
				source: '1+1'
			}
		}, {
			contents: {
				cell_type: 'markdown',
				source: 'abc'
			}
		}],
		kernelSpec: {
			name: 'testKernel',
			language: 'testLanguage',
			display_name: 'testKernelName'
		},
		save: () => undefined,
		setTrusted: () => undefined,
		validateCellRange: () => undefined
	};

	test('Convert ADS NotebookDocument into VS Code NotebookDocument', async () => {
		let expectedDoc: vscode.NotebookDocument = {
			get uri() { return testDoc.uri; },
			get notebookType() { return testDoc.providerId; },
			get version() { return undefined; },
			get isDirty() { return true; },
			get isUntitled() { return true; },
			get isClosed() { return false; },
			get metadata() { return {}; },
			get cellCount() { return 2; },
			cellAt: () => undefined,
			getCells: () => undefined,
			save: () => undefined
		};

		let actualDoc = new VSCodeNotebookDocument(testDoc);
		assert.deepStrictEqual(actualDoc.uri, expectedDoc.uri);
		assert.strictEqual(actualDoc.notebookType, expectedDoc.notebookType);
		assert.strictEqual(actualDoc.version, expectedDoc.version);
		assert.strictEqual(actualDoc.isDirty, expectedDoc.isDirty);
		assert.strictEqual(actualDoc.isUntitled, expectedDoc.isUntitled);
		assert.strictEqual(actualDoc.isClosed, expectedDoc.isClosed);
		assert.deepStrictEqual(actualDoc.metadata, expectedDoc.metadata);
		assert.strictEqual(actualDoc.cellCount, expectedDoc.cellCount);
	});

	// Have to validate cell fields manually since one of the NotebookCell fields is a function pointer,
	// which throws off the deepEqual assertions.
	function validateCellMatches(actual: vscode.NotebookCell, expected: vscode.NotebookCell): void {
		assert.strictEqual(actual.index, expected.index);
		assert.deepStrictEqual(actual.document.uri, expected.document.uri);
		assert.strictEqual(actual.document.languageId, expected.document.languageId);
		assert.deepStrictEqual(actual.notebook.uri, expected.notebook.uri);
	}
	function validateCellsMatch(actual: vscode.NotebookCell[], expected: vscode.NotebookCell[]): void {
		assert.strictEqual(actual.length, expected.length, 'Cell arrays did not have equal lengths.');
		for (let i = 0; i < actual.length; i++) {
			validateCellMatches(actual[i], expected[i]);
		}
	}

	test('Retrieve range of cells from VS Code NotebookDocument', async () => {
		let expectedCells: vscode.NotebookCell[] = testDoc.cells.map((cell, index) => convertToVSCodeNotebookCell(cell.contents.source, index, testDoc.uri, testDoc.kernelSpec.language));
		let vsDoc = new VSCodeNotebookDocument(testDoc);

		let actualCells = vsDoc.getCells();
		validateCellsMatch(actualCells, expectedCells);

		actualCells = vsDoc.getCells({ start: 0, end: 2, isEmpty: false, with: () => undefined });
		validateCellsMatch(actualCells, expectedCells);

		actualCells = vsDoc.getCells({ start: 0, end: 1, isEmpty: false, with: () => undefined });
		validateCellsMatch(actualCells, [expectedCells[0]]);

		actualCells = vsDoc.getCells({ start: 1, end: 2, isEmpty: false, with: () => undefined });
		validateCellsMatch(actualCells, [expectedCells[1]]);
	});

	test('Retrieve specific cell from VS Code NotebookDocument', async () => {
		let expectedCells: vscode.NotebookCell[] = testDoc.cells.map((cell, index) => convertToVSCodeNotebookCell(cell.contents.source, index, testDoc.uri, testDoc.kernelSpec.language));
		let vsDoc = new VSCodeNotebookDocument(testDoc);

		let firstCell = vsDoc.cellAt(0);
		validateCellMatches(firstCell, expectedCells[0]);

		firstCell = vsDoc.cellAt(-5);
		validateCellMatches(firstCell, expectedCells[0]);

		let secondCell = vsDoc.cellAt(1);
		validateCellMatches(secondCell, expectedCells[1]);

		secondCell = vsDoc.cellAt(10);
		validateCellMatches(secondCell, expectedCells[1]);
	});
});

suite('Notebook Controller', () => {
});

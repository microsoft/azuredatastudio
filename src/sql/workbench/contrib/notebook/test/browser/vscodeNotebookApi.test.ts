/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSCodeContentManager } from 'vs/workbench/api/common/vscodeSerializationProvider';
import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import * as sinon from 'sinon';
import { NotebookCellKind } from 'vs/workbench/api/common/extHostTypes';
import { VSBuffer } from 'vs/base/common/buffer';
import * as assert from 'assert';

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
			'kernelspec': {
				name: 'python3',
				display_name: 'Python 3',
				language: 'python'
			},
			'language_info': {
				name: 'python',
				version: '3.8.10',
				mimetype: 'text/x-python',
				codemirror_mode: {
					name: 'ipython',
					version: '3'
				}
			}
		}
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
		nbformat_minor: 2,
		nbformat: 4,
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

	test('Convert ADS notebook output to VSCode notebook output', async () => {
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
});

suite('Notebook Controller', () => {
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import assert = require('assert');

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { context } from './testContext';
import { sqlNotebookContent, writeNotebookToFile, pyPark3KernelMetadata, sqlKernelMetadata, pythonKernelMetadata, pySparkNotebookContent } from './notebook.util';
import { getBdcServer } from './testConfig';
import { connectToServer } from './utils';

if (context.RunTest) {
	suite('Notebook integration test suite', async () => {
		test('Sql NB test', async function () {
			this.timeout(6000);
			let notebook = await openNotebook(sqlNotebookContent, sqlKernelMetadata);

			const expectedOutput0 = '(1 row affected)';
			let cellOutputs = notebook.document.cells[0].contents.outputs;
			assert(cellOutputs.length === 3, `Expected length: 3, Acutal: '${cellOutputs.length}'`);
			let actualOutput0 = (<azdata.nb.IDisplayData>cellOutputs[0]).data['text/html'];
			assert(actualOutput0 === expectedOutput0, `Expected row count: '${expectedOutput0}', Acutal: '${actualOutput0}'`);
			let actualOutput2 = (<azdata.nb.IExecuteResult>cellOutputs[2]).data['application/vnd.dataresource+json'].data[0];
			assert(actualOutput2[0] === '1', `Expected result: 1, Acutal: '${actualOutput2[0]}'`);
		});

		test('Python3 notebook test', async function () {
			this.timeout(6000);
			let notebook = await openNotebook(pySparkNotebookContent, pythonKernelMetadata);
			let cellOutputs = notebook.document.cells[0].contents.outputs;
			let result = (<azdata.nb.IExecuteResult>cellOutputs[0]).data['text/plain'];
			assert(result === '2', `Expected: 2, Acutal: '${result}'`);
		});

		test('PySpark3 notebook test', async function () {
			this.timeout(12000);
			let notebook = await openNotebook(pySparkNotebookContent, pyPark3KernelMetadata);
			let cellOutputs = notebook.document.cells[0].contents.outputs;
			let sparkResult = (<azdata.nb.IStreamResult>cellOutputs[3]).text;
			assert(sparkResult === '2', `Expected: 2, Acutal: '${sparkResult}'`);
		});
	});
}
async function openNotebook(content: azdata.nb.INotebookContents, kernelMetadata: any): Promise<azdata.nb.NotebookEditor> {
	let notebookConfig = vscode.workspace.getConfiguration('notebook');
	notebookConfig.update('pythonPath', process.env.PYTHON_TEST_PATH, 1);
	let server = await getBdcServer();
	await connectToServer(server, 6000);
	let pythonNotebook = Object.assign({}, content, { metadata: kernelMetadata });
	let uri = writeNotebookToFile(pythonNotebook);
	let notebook = await azdata.nb.showNotebookDocument(uri);
	assert(notebook.document.cells.length === 1, 'Notebook should have 1 cell');
	let ran = await notebook.runCell(notebook.document.cells[0]);
	assert(ran, 'Notebook runCell should succeed');
	return notebook;
}


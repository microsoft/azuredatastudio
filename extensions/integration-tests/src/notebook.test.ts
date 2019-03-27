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
import { sqlNotebookContent, writeNotebookToFile, sqlKernelMetadata, pythonKernelMetadata, pySparkNotebookContent, pythonNotebookMultipleCellsContent, sqlNotebookMultipleCellsContent } from './notebook.util';
import { getBdcServer } from './testConfig';
import { connectToServer } from './utils';

if (context.RunTest) {
	suite('Notebook integration test suite', () => {
		test('Sql NB test', async function () {
			console.log('Start Sql NB test');
			let notebook = await openNotebook(sqlNotebookContent, sqlKernelMetadata);
			const expectedOutput0 = '(1 row affected)';
			let cellOutputs = notebook.document.cells[0].contents.outputs;
			console.log('Got cell outputs');
			assert(cellOutputs.length === 3, `Expected length: 3, Acutal: '${cellOutputs.length}'`);
			let actualOutput0 = (<azdata.nb.IDisplayData>cellOutputs[0]).data['text/html'];
			console.log('Got first output');
			assert(actualOutput0 === expectedOutput0, `Expected row count: '${expectedOutput0}', Acutal: '${actualOutput0}'`);
			let actualOutput2 = (<azdata.nb.IExecuteResult>cellOutputs[2]).data['application/vnd.dataresource+json'].data[0];
			assert(actualOutput2[0] === '1', `Expected result: 1, Acutal: '${actualOutput2[0]}'`);
			console.log('Sql NB done');
		});

		test('Sql NB multiple cells test', async function () {
			let notebook = await openNotebook(sqlNotebookMultipleCellsContent, sqlKernelMetadata, true);
			const expectedOutput0 = '(1 row affected)';
			for (let i = 0; i < 3; i++) {
				let cellOutputs = notebook.document.cells[i].contents.outputs;
				console.log('Got cell outputs');
				assert(cellOutputs.length === 3, `Expected length: 3, Actual: '${cellOutputs.length}'`);
				let actualOutput0 = (<azdata.nb.IDisplayData>cellOutputs[0]).data['text/html'];
				console.log('Got first output');
				assert(actualOutput0 === expectedOutput0, `Expected row count: '${expectedOutput0}', Actual: '${actualOutput0}'`);
				let actualOutput2 = (<azdata.nb.IExecuteResult>cellOutputs[2]).data['application/vnd.dataresource+json'].data[0];
				assert(actualOutput2[0] === i.toString(), `Expected result: ${i.toString()}, Actual: '${actualOutput2[0]}'`);
				console.log('Sql multiple cells NB done');
			}
		});

		test('Python3 notebook test', async function () {
			console.log('Start Python3 NB test');
			let notebook = await openNotebook(pySparkNotebookContent, pythonKernelMetadata);
			let cellOutputs = notebook.document.cells[0].contents.outputs;
			console.log('Got cell outputs');
			let result = (<azdata.nb.IExecuteResult>cellOutputs[0]).data['text/plain'];
			assert(result === '2', `Expected: 2, Actual: '${result}'`);
			console.log('Python3 NB done');
		});

		test('Python3 multiple cells notebook test', async function () {
			let notebook = await openNotebook(pythonNotebookMultipleCellsContent, pythonKernelMetadata, true);
			for (let i = 0; i < 4; i++) {
				let cellOutputs = notebook.document.cells[i].contents.outputs;
				let result = (<azdata.nb.IExecuteResult>cellOutputs[0]).data['text/plain'];
				let expectedResult = 2+i;
				assert(result === expectedResult.toString(), `Expected: '${expectedResult.toString()}', Actual: '${result}'`);
				console.log('Python3 multiple cells NB done');
			}
		});

		// test('PySpark3 notebook test', async function () {
		// 	this.timeout(12000);
		// 	let notebook = await openNotebook(pySparkNotebookContent, pySpark3KernelMetadata);
		// 	let cellOutputs = notebook.document.cells[0].contents.outputs;
		// 	let sparkResult = (<azdata.nb.IStreamResult>cellOutputs[3]).text;
		// 	assert(sparkResult === '2', `Expected: 2, Actual: '${sparkResult}'`);
		// });
	});
}
async function openNotebook(content: azdata.nb.INotebookContents, kernelMetadata: any, runAllCells?: boolean): Promise<azdata.nb.NotebookEditor> {
	let notebookConfig = vscode.workspace.getConfiguration('notebook');
	notebookConfig.update('pythonPath', process.env.PYTHON_TEST_PATH, 1);
	let server = await getBdcServer();
	await connectToServer(server, 6000);
	let pythonNotebook = Object.assign({}, content, { metadata: kernelMetadata });
	let uri = writeNotebookToFile(pythonNotebook);
	console.log(uri);
	let notebook = await azdata.nb.showNotebookDocument(uri);
	console.log('Notebook is opened');

	if (!runAllCells) {
		assert(notebook.document.cells.length === 1, 'Notebook should have 1 cell');
		console.log('Before run notebook cell');
		let ran = await notebook.runCell(notebook.document.cells[0]);
		console.log('After run notebook cell');
		assert(ran, 'Notebook runCell should succeed');
	} else {
		console.log('Before run all notebook cells');
		let ran = await notebook.runAllCells();
		assert(ran, 'Notebook runCell should succeed');
		assert(notebook !== undefined && notebook !== null, 'Expected notebook object is defined');
	}

	return notebook;
}


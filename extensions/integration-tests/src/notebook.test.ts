/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as assert from 'assert';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { context } from './testContext';
import { sqlNotebookContent, writeNotebookToFile, sqlKernelMetadata, getFileName, pySparkNotebookContent, pySpark3KernelMetadata, pythonKernelMetadata, sqlNotebookMultipleCellsContent } from './notebook.util';
import { getBdcServer, getConfigValue, EnvironmentVariable_PYTHON_PATH } from './testConfig';
import { connectToServer } from './utils';
import * as fs from 'fs';

if (context.RunTest) {
	suite('Notebook integration test suite', function () {
		setup(function () {
			this.NbTester = new NotebooksTester(this.currentTest.title);
		});
		teardown(function () {
			this.NbTester.Cleanup(this.currentTest.title);
		});

		test('Sql NB test', async function () {
			await this.NbTester.SqlNbTest(this.test.title);
		});

		test('Sql NB multiple cells test', async function () {
			await this.NbTester.SqlNbMultipleCellsTest(this.test.title);
		});

		test('Clear all outputs - SQL notebook ', async function () {
			await this.NbTester.ClearAllOutputsSqlNb(this.test.title);
		});

		if (process.env['RUN_PYTHON3_TEST'] === '1') {
			test('Python3 notebook test', async function () {
				await this.NbTester.Python3NbTest(this.test.title);
			});

			test('Clear all outputs - Python3 notebook ', async function () {
				await this.NbTester.ClearAllOutputsPython3Nb(this.test.title);
			});
		}

		if (process.env['RUN_PYSPARK_TEST'] === '1') {
			test('PySpark3 notebook test', async function () {
				await this.NbTester.PySpark3NbTest(this.test.title);
			});
		}
	});
}

class NotebooksTester {
	setup()
	{
		console.log(`environment variable SuiteType set to ${process.env.SuiteType}`);
	}

	Cleanup(testName: string) {
		try {
			let fileName = getFileName(testName);
			if (fs.existsSync(fileName)) {
				fs.unlinkSync(fileName);
				console.log(`"${fileName}" is deleted.`);
			}
		}
		catch (err) {
			console.log(err);
		}
		finally {
			console.log(`"${testName}" is done`);
		}
	}

	constructor(testName: string) {
		console.log(`Start "${testName}"`);
	}

	async SqlNbTest(testName: string) {
		let notebook = await this.openNotebook(sqlNotebookContent, sqlKernelMetadata, testName);
		const expectedOutput0 = '(1 row affected)';
		let cellOutputs = notebook.document.cells[0].contents.outputs;
		console.log('Got cell outputs');
		assert(cellOutputs.length === 3, `Expected length: 3, Actual: ${cellOutputs.length}`);
		let actualOutput0 = (<azdata.nb.IDisplayData>cellOutputs[0]).data['text/html'];
		console.log('Got first output');
		assert(actualOutput0 === expectedOutput0, `Expected row count: ${expectedOutput0}, Actual: ${actualOutput0}`);
		let actualOutput2 = (<azdata.nb.IExecuteResult>cellOutputs[2]).data['application/vnd.dataresource+json'].data[0];
		assert(actualOutput2[0] === '1', `Expected result: 1, Actual: '${actualOutput2[0]}'`);
	}

	async ClearAllOutputsSqlNb(testName: string) {
		let notebook = await this.openNotebook(sqlNotebookContent, sqlKernelMetadata, testName);
		await this.verifyClearAllOutputs(notebook);
	}

	async PySpark3NbTest(testName: string) {
		let notebook = await this.openNotebook(pySparkNotebookContent, pySpark3KernelMetadata, testName);
		let cellOutputs = notebook.document.cells[0].contents.outputs;
		let sparkResult = (<azdata.nb.IStreamResult>cellOutputs[3]).text;
		assert(sparkResult === '2', `Expected spark result: 2, Actual: ${sparkResult}`);
	}

	async ClearAllOutputsPython3Nb(testName: string) {
		let notebook = await this.openNotebook(pySparkNotebookContent, pythonKernelMetadata, testName);
		await this.verifyClearAllOutputs(notebook);
	}

	async Python3NbTest(testName: string) {
		let notebook = await this.openNotebook(pySparkNotebookContent, pythonKernelMetadata, testName);
		let cellOutputs = notebook.document.cells[0].contents.outputs;
		console.log('Got cell outputs');
		let result = (<azdata.nb.IExecuteResult>cellOutputs[0]).data['text/plain'];
		assert(result === '2', `Expected python result: 2, Actual: ${result}`);
	}

	async SqlNbMultipleCellsTest(testName: string) {
		let notebook = await this.openNotebook(sqlNotebookMultipleCellsContent, sqlKernelMetadata, testName, true);
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
	}

	async openNotebook(content: azdata.nb.INotebookContents, kernelMetadata: any, testName: string, runAllCells?: boolean): Promise<azdata.nb.NotebookEditor> {
		let notebookConfig = vscode.workspace.getConfiguration('notebook');
		notebookConfig.update('pythonPath', getConfigValue(EnvironmentVariable_PYTHON_PATH), 1);
		let server = await getBdcServer();
		assert(server && server.serverName, 'No server could be found in openNotebook');
		await connectToServer(server, 6000);
		let notebookJson = Object.assign({}, content, { metadata: kernelMetadata });
		let uri = writeNotebookToFile(notebookJson, testName);
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
	async verifyClearAllOutputs(notebook: azdata.nb.NotebookEditor) {
		let cellWithOutputs = notebook.document.cells.find(cell => cell.contents && cell.contents.outputs && cell.contents.outputs.length > 0);
		assert(cellWithOutputs !== undefined, 'Could not find notebook cells with outputs');
		console.log('Before clearing cell outputs');
		let clearedOutputs = await notebook.clearAllOutputs();
		let cells = notebook.document.cells;
		cells.forEach(cell => {
			assert(cell.contents && cell.contents.outputs && cell.contents.outputs.length === 0, `Expected Output: 0, Actual: '${cell.contents.outputs.length}'`);
		});
		assert(clearedOutputs, 'Outputs of all the code cells from Python notebook should be cleared');
		console.log('After clearing cell outputs');
	}
}


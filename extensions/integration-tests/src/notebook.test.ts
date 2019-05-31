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
import { sqlNotebookContent, writeNotebookToFile, sqlKernelMetadata, getFileName, pySparkNotebookContent, pySpark3KernelMetadata, pythonKernelMetadata, sqlNotebookMultipleCellsContent, notebookContentForCellLanguageTest } from './notebook.util';
import { getBdcServer, getConfigValue, EnvironmentVariable_PYTHON_PATH } from './testConfig';
import { connectToServer } from './utils';
import * as fs from 'fs';
import { stressify } from 'adstest';

if (context.RunTest) {
	suite('Notebook integration test suite', function () {
		setup(async function () {
			console.log(`Start "${this.currentTest.title}"`);
			let server = await getBdcServer();
			assert(server && server.serverName, 'No server could be found');
			await connectToServer(server, 6000);
		});
		teardown(async function () {
			await (new NotebookTester()).cleanup(this.currentTest.title);
		});

		test('Sql NB test', async function () {
			await (new NotebookTester()).sqlNbTest(this.test.title);
		});

		test('Sql NB multiple cells test', async function () {
			await (new NotebookTester()).sqlNbMultipleCellsTest(this.test.title);
		});

		test('Clear all outputs - SQL notebook ', async function () {
			await (new NotebookTester()).sqlNbClearAllOutputs(this.test.title);
		});

		test('sql language test', async function () {
			await (new NotebookTester()).sqlLanguageTest(this.test.title);
		});

		if (process.env['RUN_PYTHON3_TEST'] === '1') {
			test('Python3 notebook test', async function () {
				await (new NotebookTester()).python3NbTest(this.test.title);
			});

			test('Clear all outputs - Python3 notebook ', async function () {
				await (new NotebookTester()).python3ClearAllOutputs(this.test.title);
			});

			test('python language test', async function () {
				await (new NotebookTester()).pythonLanguageTest(this.test.title);
			});
		}

		if (process.env['RUN_PYSPARK_TEST'] === '1') {
			test('PySpark3 notebook test', async function () {
				await (new NotebookTester()).pySpark3NbTest(this.test.title);
			});
		}

		/* After https://github.com/microsoft/azuredatastudio/issues/5598 is fixed, enable these tests.
		test('scala language test', async function () {
			await (new NotebookTester()).scalaLanguageTest(this.test.title);
		});

		test('empty language test', async function () {
			await (new NotebookTester()).emptyLanguageTest(this.test.title);
		});

		test('cplusplus language test', async function () {
			await (new NotebookTester()).cplusplusLanguageTest(this.test.title);
		});
		*/
	});
}

class NotebookTester {
	private static ParallelCount = 1;

	invocationCount: number = 0;

	@stressify({ dop: NotebookTester.ParallelCount })
	async pySpark3NbTest(title: string): Promise<void> {
		let notebook = await this.openNotebook(pySparkNotebookContent, pySpark3KernelMetadata, title + this.invocationCount++);
		let cellOutputs = notebook.document.cells[0].contents.outputs;
		let sparkResult = (<azdata.nb.IStreamResult>cellOutputs[3]).text;
		assert(sparkResult === '2', `Expected spark result: 2, Actual: ${sparkResult}`);
	}

	@stressify({ dop: NotebookTester.ParallelCount })
	async python3ClearAllOutputs(title: string): Promise<void> {
		let notebook = await this.openNotebook(pySparkNotebookContent, pythonKernelMetadata, title + this.invocationCount++);
		await this.verifyClearAllOutputs(notebook);
	}

	@stressify({ dop: NotebookTester.ParallelCount })
	async python3NbTest(title: string): Promise<void> {
		let notebook = await this.openNotebook(pySparkNotebookContent, pythonKernelMetadata, title + this.invocationCount++);
		let cellOutputs = notebook.document.cells[0].contents.outputs;
		console.log('Got cell outputs ---');
		if (cellOutputs) {
			cellOutputs.forEach(o => console.log(JSON.stringify(o, undefined, '\t')));
		}
		let result = (<azdata.nb.IExecuteResult>cellOutputs[0]).data['text/plain'];
		assert(result === '2', `Expected python result: 2, Actual: ${result}`);
	}

	@stressify({ dop: NotebookTester.ParallelCount })
	async sqlNbClearAllOutputs(title: string): Promise<void> {
		let notebook = await this.openNotebook(sqlNotebookContent, sqlKernelMetadata, title + this.invocationCount++);
		await this.verifyClearAllOutputs(notebook);
	}

	@stressify({ dop: NotebookTester.ParallelCount })
	async sqlNbMultipleCellsTest(title: string): Promise<void> {
		let notebook = await this.openNotebook(sqlNotebookMultipleCellsContent, sqlKernelMetadata, title + this.invocationCount++, true);
		const expectedOutput0 = '(1 row affected)';
		for (let i = 0; i < 3; i++) {
			let cellOutputs = notebook.document.cells[i].contents.outputs;
			console.log(`Got cell outputs --- ${i}`);
			if (cellOutputs) {
				cellOutputs.forEach(o => console.log(o));
			}
			assert(cellOutputs.length === 3, `Expected length: 3, Actual: '${cellOutputs.length}'`);
			let actualOutput0 = (<azdata.nb.IDisplayData>cellOutputs[0]).data['text/html'];
			console.log('Got first output');
			assert(actualOutput0 === expectedOutput0, `Expected row count: '${expectedOutput0}', Actual: '${actualOutput0}'`);
			let actualOutput2 = (<azdata.nb.IExecuteResult>cellOutputs[2]).data['application/vnd.dataresource+json'].data[0];
			assert(actualOutput2[0] === i.toString(), `Expected result: ${i.toString()}, Actual: '${actualOutput2[0]}'`);
			console.log('Sql multiple cells NB done');
		}
	}

	@stressify({ dop: NotebookTester.ParallelCount })
	async sqlNbTest(title: string): Promise<void> {
		let notebook = await this.openNotebook(sqlNotebookContent, sqlKernelMetadata, title + this.invocationCount++, false, true);
		const expectedOutput0 = '(1 row affected)';
		let cellOutputs = notebook.document.cells[0].contents.outputs;
		console.log('Got cell outputs ---');
		if (cellOutputs) {
			cellOutputs.forEach(o => console.log(o));
		}
		assert(cellOutputs.length === 3, `Expected length: 3, Actual: ${cellOutputs.length}`);
		let actualOutput0 = (<azdata.nb.IDisplayData>cellOutputs[0]).data['text/html'];
		console.log('Got first output');
		assert(actualOutput0 === expectedOutput0, `Expected row count: ${expectedOutput0}, Actual: ${actualOutput0}`);
		let actualOutput2 = (<azdata.nb.IExecuteResult>cellOutputs[2]).data['application/vnd.dataresource+json'].data[0];
		assert(actualOutput2[0] === '1', `Expected result: 1, Actual: '${actualOutput2[0]}'`);
	}

	@stressify({ dop: NotebookTester.ParallelCount })
	async scalaLanguageTest(title: string): Promise<void> {
		let language = 'scala';
		await this.cellLanguageTest(notebookContentForCellLanguageTest, title + this.invocationCount++, language, {
			'kernelspec': {
				'name': '',
				'display_name': ''
			},
			'language_info': {
				name: language,
				version: '',
				mimetype: ''
			}
		});
	}

	@stressify({ dop: NotebookTester.ParallelCount })
	async cplusplusLanguageTest(title: string): Promise<void> {
		let language = 'cplusplus';
		await this.cellLanguageTest(notebookContentForCellLanguageTest, title + this.invocationCount++, language, {
			'kernelspec': {
				'name': '',
				'display_name': ''
			},
			'language_info': {
				name: language,
				version: '',
				mimetype: ''
			}
		});
	}
	
	@stressify({ dop: NotebookTester.ParallelCount })
	async emptyLanguageTest(title: string): Promise<void> {
		let language = '';
		await this.cellLanguageTest(notebookContentForCellLanguageTest, title + this.invocationCount++, language, {
			'kernelspec': {
				'name': '',
				'display_name': ''
			},
			'language_info': {
				name: language,
				version: '',
				mimetype: 'x-scala'
			}
		});
	}

	@stressify({ dop: NotebookTester.ParallelCount })
	async sqlLanguageTest(title: string): Promise<void> {
		let language = 'sql';
		await this.cellLanguageTest(notebookContentForCellLanguageTest, title + this.invocationCount++, language, {
			'kernelspec': {
				'name': 'sql',
				'display_name': 'SQL'
			},
			'language_info': {
				'name': 'sql',
				'version': '',
				'mimetype': ''
			}
		});
	}

	@stressify({ dop: NotebookTester.ParallelCount })
	async pythonLanguageTest(title: string): Promise<void> {
		let language = 'python';
		await this.cellLanguageTest(notebookContentForCellLanguageTest, title + this.invocationCount++, language, {
			'kernelspec': {
				'name': 'python3',
				'display_name': 'Python 3'
			},
			'language_info': {
				'name': 'python',
				'version': '',
				'mimetype': ''
			}
		});
	}

	async cleanup(testName: string): Promise<void> {
		try {
			let fileName = getFileName(testName + this.invocationCount++);
			if (fs.existsSync(fileName)) {
				fs.unlinkSync(fileName);
				console.log(`"${fileName}" is deleted.`);
			}
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
		catch (err) {
			console.log(err);
		}
		finally {
			console.log(`"${testName}" is done`);
		}
	}

	async openNotebook(content: azdata.nb.INotebookContents, kernelMetadata: any, testName: string, runAllCells?: boolean, connectToDifferentServer?: boolean): Promise<azdata.nb.NotebookEditor> {
		let notebookConfig = vscode.workspace.getConfiguration('notebook');
		notebookConfig.update('pythonPath', getConfigValue(EnvironmentVariable_PYTHON_PATH), 1);
		if (!connectToDifferentServer) {
			let server = await getBdcServer();
			assert(server && server.serverName, 'No server could be found in openNotebook');
			await connectToServer(server, 6000);
		}
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
	async verifyClearAllOutputs(notebook: azdata.nb.NotebookEditor): Promise<void> {
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
	async cellLanguageTest(content: azdata.nb.INotebookContents, testName: string, languageConfigured: string, metadataInfo: any) {
		let notebookJson = Object.assign({}, content, { metadata: metadataInfo });
		let uri = writeNotebookToFile(notebookJson, testName);
		console.log(uri);
		let notebook = await azdata.nb.showNotebookDocument(uri);
		console.log('Notebook is opened');
		await notebook.document.save(); // May be optional to do the language verification
		let languageInNotebook = notebook.document.cells[0].contents.metadata.language;
		console.log('Language set in cell: ' + languageInNotebook);
		assert(languageInNotebook === languageConfigured, `Expected cell language is: ${languageConfigured}, Actual: ${languageInNotebook}`);
	}
}


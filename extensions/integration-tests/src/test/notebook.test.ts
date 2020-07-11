/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { sqlNotebookContent, writeNotebookToFile, sqlKernelMetadata, getFileName, pySparkNotebookContent, pySparkKernelMetadata, pythonKernelMetadata, sqlNotebookMultipleCellsContent, notebookContentForCellLanguageTest, sqlKernelSpec, pythonKernelSpec, pySparkKernelSpec, CellTypes } from './notebook.util';
import { getConfigValue, EnvironmentVariable_PYTHON_PATH, TestServerProfile, getStandaloneServer } from './testConfig';
import { connectToServer, sleep, testServerProfileToIConnectionProfile } from './utils';
import * as fs from 'fs';
import { isNullOrUndefined, promisify } from 'util';

suite('Notebook integration test suite', function () {
	setup(async function () {
		console.log(`Start "${this.currentTest.title}"`);
		let server = await getStandaloneServer();
		assert(server && server.serverName, 'No server could be found');
		await connectToServer(server, 6000);
	});

	teardown(async function () {
		try {
			let fileName = getFileName(this.test.title + this.invocationCount++);
			if (await promisify(fs.exists)(fileName)) {
				await fs.promises.unlink(fileName);
				console.log(`"${fileName}" is deleted.`);
			}
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
		catch (err) {
			console.log(err);
		}
		finally {
			console.log(`"${this.test.title}" is done`);
		}
	});

	test('Sql NB test @UNSTABLE@', async function () {
		let notebook = await openNotebook(sqlNotebookContent, sqlKernelMetadata, this.test.title + this.invocationCount++, true);
		await runCell(notebook);
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
	});

	test('Sql NB multiple cells test @UNSTABLE@', async function () {
		let notebook = await openNotebook(sqlNotebookMultipleCellsContent, sqlKernelMetadata, this.test.title + this.invocationCount++);
		await runCells(notebook);
		const expectedOutput0 = '(1 row affected)';
		for (let i = 0; i < 3; i++) {
			let cellOutputs = notebook.document.cells[i].contents.outputs;
			console.log(`Got cell outputs --- ${i}`);

			if (cellOutputs) {
				cellOutputs.forEach(console.log);
			}

			assert(cellOutputs.length === 3, `Expected length: 3, Actual: '${cellOutputs.length}'`);
			let actualOutput0 = (<azdata.nb.IDisplayData>cellOutputs[0]).data['text/html'];
			console.log('Got first output');
			assert(actualOutput0 === expectedOutput0, `Expected row count: '${expectedOutput0}', Actual: '${actualOutput0}'`);

			const executeResult = cellOutputs[2] as azdata.nb.IExecuteResult;
			assert(Object.keys(executeResult).includes('data'), `Execute result did not include data key. It included ${Object.keys(executeResult)}`);
			const applicationDataResource = executeResult.data['application/vnd.dataresource+json'];

			assert(Object.keys(applicationDataResource).includes('data'), `Execute result did not include data key. It included ${Object.keys(applicationDataResource)}`);
			const actualOutput2 = applicationDataResource.data[0];

			assert(actualOutput2[0] === i.toString(), `Expected result: ${i.toString()}, Actual: '${actualOutput2[0]}'`);
			console.log('Sql multiple cells NB done');
		}
	});

	test('Sql NB run cells above and below test', async function () {
		let notebook = await openNotebook(sqlNotebookMultipleCellsContent, sqlKernelMetadata, this.test.title + this.invocationCount++);
		// When running all cells above a cell, ensure that only cells preceding current cell have output
		await runCells(notebook, true, undefined, notebook.document.cells[1]);
		assert(notebook.document.cells[0].contents.outputs.length === 3, `Expected length: '3', Actual: '${notebook.document.cells[0].contents.outputs.length}'`);
		assert(notebook.document.cells[1].contents.outputs.length === 0, `Expected length: '0', Actual: '${notebook.document.cells[1].contents.outputs.length}'`);
		assert(notebook.document.cells[2].contents.outputs.length === 0, `Expected length: '0', Actual: '${notebook.document.cells[2].contents.outputs.length}'`);

		await notebook.clearAllOutputs();

		// When running all cells below a cell, ensure that current cell and cells after have output
		await runCells(notebook, undefined, true, notebook.document.cells[1]);
		assert(notebook.document.cells[0].contents.outputs.length === 0, `Expected length: '0', Actual: '${notebook.document.cells[0].contents.outputs.length}'`);
		assert(notebook.document.cells[1].contents.outputs.length === 3, `Expected length: '3', Actual: '${notebook.document.cells[1].contents.outputs.length}'`);
		assert(notebook.document.cells[2].contents.outputs.length === 3, `Expected length: '3', Actual: '${notebook.document.cells[2].contents.outputs.length}'`);
	});

	test('Clear cell output - SQL notebook', async function () {
		let notebook = await openNotebook(sqlNotebookContent, sqlKernelMetadata, this.test.title + this.invocationCount++);
		await runCell(notebook);
		await verifyClearOutputs(notebook);
	});

	test('Clear all outputs - SQL notebook', async function () {
		let notebook = await openNotebook(sqlNotebookContent, sqlKernelMetadata, this.test.title + this.invocationCount++);
		await runCell(notebook);
		await verifyClearAllOutputs(notebook);
	});

	test('sql language test', async function () {
		let language = 'sql';
		await cellLanguageTest(notebookContentForCellLanguageTest, this.test.title + this.invocationCount++, language, {
			'kernelspec': {
				'name': language,
				'display_name': language.toUpperCase()
			},
			'language_info': {
				'name': language,
				'version': '',
				'mimetype': ''
			}
		});
	});

	// TODO: Need to make this test more reliable.
	test('should not be dirty after saving notebook test @UNSTABLE@', async function () {
		// Given a notebook that's been edited (in this case, open notebook runs the 1st cell and adds an output)
		let notebook = await openNotebook(sqlNotebookContent, sqlKernelMetadata, this.test.title);
		await runCell(notebook);
		assert(notebook.document.providerId === 'sql', `Expected providerId to be sql, Actual: ${notebook.document.providerId}`);
		assert(notebook.document.kernelSpec.name === 'SQL', `Expected first kernel name: SQL, Actual: ${notebook.document.kernelSpec.name}`);
		assert(notebook.document.isDirty === true, 'Notebook should be dirty after edit');

		// When I save it, it should no longer be dirty
		let saved = await notebook.document.save();
		assert(saved === true, 'Expect initial save to succeed');
		// Note: need to sleep after save as the change events happen after save
		// We need to give back the thread or the event won't have been drained.
		// This is consistent with VSCode APIs, so keeping as-is
		await sleep(100);
		assert(notebook.document.isDirty === false, 'Notebook should not be dirty after initial save');

		// And when I edit again, should become dirty
		let edited = await notebook.edit(builder => {
			builder.insertCell({
				cell_type: CellTypes.Code,
				source: ''
			});
		});
		assert(edited === true, 'Expect edit to succeed');
		await sleep(100);
		assert(notebook.document.isDirty === true, 'Notebook should be dirty after edit');

		// Finally on 2nd save it should no longer be dirty
		saved = await notebook.document.save();
		await sleep(100);
		assert(saved === true, 'Expect save after edit to succeed');
		assert(notebook.document.isDirty === false, 'Notebook should not be dirty after 2nd save');
	});

	if (process.env['RUN_PYTHON3_TEST'] === '1') {
		test('Python3 notebook test', async function () {
			let notebook = await openNotebook(pySparkNotebookContent, pythonKernelMetadata, this.test.title + this.invocationCount++);
			await runCell(notebook);
			let cellOutputs = notebook.document.cells[0].contents.outputs;
			console.log('Got cell outputs ---');
			if (cellOutputs) {
				cellOutputs.forEach(o => console.log(JSON.stringify(o, undefined, '\t')));
			}
			let result = (<azdata.nb.IExecuteResult>cellOutputs[0]).data['text/plain'];
			assert(result === '2', `Expected python result: 2, Actual: ${result}`);
		});

		test('Clear all outputs - Python3 notebook ', async function () {
			let notebook = await openNotebook(pySparkNotebookContent, pythonKernelMetadata, this.test.title + this.invocationCount++);
			await runCell(notebook);
			await verifyClearAllOutputs(notebook);
		});

		test('python language test', async function () {
			let language = 'python';
			await cellLanguageTest(notebookContentForCellLanguageTest, this.test.title + this.invocationCount++, language, {
				'kernelspec': {
					'name': 'python3',
					'display_name': 'Python 3'
				},
				'language_info': {
					'name': language,
					'version': '',
					'mimetype': ''
				}
			});
		});

		test('Change kernel different provider SQL to Python to SQL', async function () {
			let notebook = await openNotebook(sqlNotebookContent, sqlKernelMetadata, this.test.title);
			await runCell(notebook);
			assert(notebook.document.providerId === 'sql', `Expected providerId to be sql, Actual: ${notebook.document.providerId}`);
			assert(notebook.document.kernelSpec.name === 'SQL', `Expected first kernel name: SQL, Actual: ${notebook.document.kernelSpec.name}`);

			let kernelChanged = await notebook.changeKernel(pythonKernelSpec);
			assert(notebook.document.providerId === 'jupyter', `Expected providerId to be jupyter, Actual: ${notebook.document.providerId}`);
			assert(kernelChanged && notebook.document.kernelSpec.name === 'python3', `Expected second kernel name: python3, Actual: ${notebook.document.kernelSpec.name}`);

			kernelChanged = await notebook.changeKernel(sqlKernelSpec);
			assert(notebook.document.providerId === 'sql', `Expected providerId to be sql, Actual: ${notebook.document.providerId}`);
			assert(kernelChanged && notebook.document.kernelSpec.name === 'SQL', `Expected third kernel name: SQL, Actual: ${notebook.document.kernelSpec.name}`);
		});

		test('Change kernel different provider Python to SQL to Python', async function () {
			let notebook = await openNotebook(pySparkNotebookContent, pythonKernelMetadata, this.test.title);
			await runCell(notebook);
			assert(notebook.document.providerId === 'jupyter', `Expected providerId to be jupyter, Actual: ${notebook.document.providerId}`);
			assert(notebook.document.kernelSpec.name === 'python3', `Expected first kernel name: python3, Actual: ${notebook.document.kernelSpec.name}`);

			let kernelChanged = await notebook.changeKernel(sqlKernelSpec);
			assert(notebook.document.providerId === 'sql', `Expected providerId to be sql, Actual: ${notebook.document.providerId}`);
			assert(kernelChanged && notebook.document.kernelSpec.name === 'SQL', `Expected second kernel name: SQL, Actual: ${notebook.document.kernelSpec.name}`);

			kernelChanged = await notebook.changeKernel(pythonKernelSpec);
			assert(notebook.document.providerId === 'jupyter', `Expected providerId to be jupyter, Actual: ${notebook.document.providerId}`);
			assert(kernelChanged && notebook.document.kernelSpec.name === 'python3', `Expected third kernel name: python3, Actual: ${notebook.document.kernelSpec.name}`);
		});

		test('Change kernel same provider Python to PySpark to Python', async function () {
			let notebook = await openNotebook(pySparkNotebookContent, pythonKernelMetadata, this.test.title);
		await runCell(notebook);
		assert(notebook.document.providerId === 'jupyter', `Expected providerId to be jupyter, Actual: ${notebook.document.providerId}`);
		assert(notebook.document.kernelSpec.name === 'python3', `Expected first kernel name: python3, Actual: ${notebook.document.kernelSpec.name}`);

		let kernelChanged = await notebook.changeKernel(pySparkKernelSpec);
		assert(notebook.document.providerId === 'jupyter', `Expected providerId to be jupyter, Actual: ${notebook.document.providerId}`);
		assert(kernelChanged && notebook.document.kernelSpec.name === 'pysparkkernel', `Expected second kernel name: pysparkkernel, Actual: ${notebook.document.kernelSpec.name}`);

		kernelChanged = await notebook.changeKernel(pythonKernelSpec);
		assert(notebook.document.providerId === 'jupyter', `Expected providerId to be jupyter, Actual: ${notebook.document.providerId}`);
		assert(kernelChanged && notebook.document.kernelSpec.name === 'python3', `Expected third kernel name: python3, Actual: ${notebook.document.kernelSpec.name}`);
		});
	}

	if (process.env['RUN_PYSPARK_TEST'] === '1') {
		test('PySpark notebook test', async function () {
			let notebook = await openNotebook(pySparkNotebookContent, pySparkKernelMetadata, this.test.title + this.invocationCount++);
			await runCell(notebook);
			let cellOutputs = notebook.document.cells[0].contents.outputs;
			let sparkResult = (<azdata.nb.IStreamResult>cellOutputs[3]).text;
			assert(sparkResult === '2', `Expected spark result: 2, Actual: ${sparkResult}`);
		});
	}

	/* After https://github.com/microsoft/azuredatastudio/issues/5598 is fixed, enable these tests.
	test('scala language test', async function () {
		let language = 'scala';
		await cellLanguageTest(notebookContentForCellLanguageTest, this.test.title + this.invocationCount++, language, {
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
	});

	test('empty language test', async function () {
		let language = '';
		await cellLanguageTest(notebookContentForCellLanguageTest, this.test.title + this.invocationCount++, language, {
			'kernelspec': {
				'name': language,
				'display_name': ''
			},
			'language_info': {
				name: language,
				version: '',
				mimetype: 'x-scala'
			}
		});
	});

	test('cplusplus language test', async function () {
		let language = 'cplusplus';
		await cellLanguageTest(notebookContentForCellLanguageTest, this.test.title + this.invocationCount++, language, {
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
	});
	*/
});

async function openNotebook(content: azdata.nb.INotebookContents, kernelMetadata: any, testName: string, connectToDifferentServer?: boolean): Promise<azdata.nb.NotebookEditor> {
	let notebookConfig = vscode.workspace.getConfiguration('notebook');
	notebookConfig.update('pythonPath', getConfigValue(EnvironmentVariable_PYTHON_PATH), 1);
	let server: TestServerProfile;
	if (!connectToDifferentServer) {
		server = await getStandaloneServer();
		assert(server && server.serverName, 'No server could be found in openNotebook');
		await connectToServer(server, 6000);
	}
	let notebookJson = Object.assign({}, content, { metadata: kernelMetadata });
	let uri = writeNotebookToFile(notebookJson, testName);
	console.log('Notebook uri ' + uri);
	let nbShowOptions: azdata.nb.NotebookShowOptions;
	if (server) {
		nbShowOptions = { connectionProfile: testServerProfileToIConnectionProfile(server) };
	}
	let notebook = await azdata.nb.showNotebookDocument(uri, nbShowOptions);
	return notebook;
}

async function runCells(notebook: azdata.nb.NotebookEditor, runCellsAbove?: boolean, runCellsBelow?: boolean, currentCell?: azdata.nb.NotebookCell) {
	assert(notebook !== undefined && notebook !== null, 'Expected notebook object is defined');
	let ran;
	if (runCellsAbove) {
		ran = await notebook.runAllCells(undefined, currentCell);
	} else if (runCellsBelow) {
		ran = await notebook.runAllCells(currentCell, undefined);
	} else {
		ran = await notebook.runAllCells();
	}
	assert(ran, 'Notebook runCell should succeed');
}

async function runCell(notebook: azdata.nb.NotebookEditor, cell?: azdata.nb.NotebookCell) {
	if (isNullOrUndefined(cell)) {
		cell = notebook.document.cells[0];
	}
	let ran = await notebook.runCell(cell);
	assert(ran, 'Notebook runCell should succeed');
}

async function verifyClearAllOutputs(notebook: azdata.nb.NotebookEditor): Promise<void> {
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

async function verifyClearOutputs(notebook: azdata.nb.NotebookEditor): Promise<void> {
	let cellWithOutputs = notebook.document.cells[0].contents && notebook.document.cells[0].contents.outputs && notebook.document.cells[0].contents.outputs.length > 0;
	assert(cellWithOutputs === true, 'Expected first cell to have outputs');
	let clearedOutputs = await notebook.clearOutput(notebook.document.cells[0]);
	let firstCell = notebook.document.cells[0];
	assert(firstCell.contents && firstCell.contents.outputs && firstCell.contents.outputs.length === 0, `Expected Output: 0, Actual: '${firstCell.contents.outputs.length}'`);
	assert(clearedOutputs, 'Outputs of requested code cell should be cleared');
}

async function cellLanguageTest(content: azdata.nb.INotebookContents, testName: string, languageConfigured: string, metadataInfo: any) {
	let notebookJson = Object.assign({}, content, { metadata: metadataInfo });
	let uri = writeNotebookToFile(notebookJson, testName);
	let notebook = await azdata.nb.showNotebookDocument(uri);
	await notebook.document.save();
	let languageInNotebook = notebook.document.cells[0].contents.metadata.language;
	assert(languageInNotebook === languageConfigured, `Expected cell language is: ${languageConfigured}, Actual: ${languageInNotebook}`);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as tempWrite from 'temp-write';
import * as assert from 'assert';
import 'mocha';

import { JupyterController } from '../jupyter/jupyterController';
import { INotebook, CellTypes } from '../contracts/content';
import JupyterServerInstallation from '../jupyter/jupyterServerInstallation';

describe('Notebook Extension Integration Tests', function () {
	this.timeout(600000);

	let expectedNotebookContent: INotebook = {
		cells: [{
			cell_type: CellTypes.Code,
			source: '1+1',
			metadata: { language: 'python' },
			execution_count: 1
		}],
		metadata: {
			'kernelspec': {
				'name': 'pyspark3kernel',
				'display_name': 'PySpark3'
			}
		},
		nbformat: 4,
		nbformat_minor: 2
	};

	let installComplete = false;
	let pythonInstallDir = process.env.PYTHON_TEST_PATH;
	let jupyterController: JupyterController;
	before(async function () {
		assert.ok(pythonInstallDir, 'Python install directory was not defined.');

		let notebookExtension: vscode.Extension<any>;
		while (true) {
			notebookExtension = vscode.extensions.getExtension('Microsoft.notebook');
			if (notebookExtension && notebookExtension.isActive) {
				break;
			} else {
				await new Promise(resolve => { setTimeout(resolve, 1000); });
			}
		}

		jupyterController = notebookExtension.exports.getJupyterController() as JupyterController;

		await jupyterController.jupyterInstallation.startInstallProcess(false, pythonInstallDir);
		installComplete = true;
	});

	it('Should connect to local notebook server with result 2', async function () {
		should(installComplete).be.true('Python setup did not complete.');
		should(JupyterServerInstallation.getPythonInstallPath(jupyterController.jupyterInstallation.apiWrapper)).be.equal(pythonInstallDir);

		let pythonNotebook = Object.assign({}, expectedNotebookContent, { metadata: { kernelspec: { name: 'python3', display_name: 'Python 3' } } });
		let uri = writeNotebookToFile(pythonNotebook);

		let notebook = await azdata.nb.showNotebookDocument(uri);
		should(notebook.document.cells).have.length(1);
		let ran = await notebook.runCell(notebook.document.cells[0]);
		should(ran).be.true('Notebook runCell failed');
		let cellOutputs = notebook.document.cells[0].contents.outputs;
		should(cellOutputs).have.length(1);
		let result = (<azdata.nb.IExecuteResult>cellOutputs[0]).data['text/plain'];
		should(result).equal('2');

		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	});
});

function writeNotebookToFile(pythonNotebook: INotebook): vscode.Uri {
	let notebookContentString = JSON.stringify(pythonNotebook);
	let localFile = tempWrite.sync(notebookContentString, 'notebook.ipynb');
	let uri = vscode.Uri.file(localFile);
	return uri;
}
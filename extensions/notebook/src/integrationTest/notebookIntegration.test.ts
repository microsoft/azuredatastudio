/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import * as tempWrite from 'temp-write';
import 'mocha';

import { JupyterController } from '../jupyter/jupyterController';
import { INotebook, CellTypes } from '../contracts/content';

describe('Notebook Integration Test', function (): void {
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


	it('Should connect to local notebook server with result 2', async function () {
		this.timeout(60000);
		let pythonNotebook = Object.assign({}, expectedNotebookContent, { metadata: { kernelspec: { name: 'python3', display_name: 'Python 3' } } });
		let uri = writeNotebookToFile(pythonNotebook);
		await ensureJupyterInstalled();

		let notebook = await sqlops.nb.showNotebookDocument(uri);
		should(notebook.document.cells).have.length(1);
		let ran = await notebook.runCell(notebook.document.cells[0]);
		should(ran).be.true('Notebook runCell failed');
		let cellOutputs = notebook.document.cells[0].contents.outputs;
		should(cellOutputs).have.length(1);
		let result = (<sqlops.nb.IExecuteResult>cellOutputs[0]).data['text/plain'];
		should(result).equal('2');

		try {
			// TODO support closing the editor. Right now this prompts and there's no override for this. Need to fix in core
			// Close the editor using the recommended vscode API
			//await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
		catch (e) { }
	});

	it('Should connect to remote spark server with result 2', async function () {
		this.timeout(240000);
		let uri = writeNotebookToFile(expectedNotebookContent);
		await ensureJupyterInstalled();

		// Given a connection to a server exists
		let connectionId = await connectToSparkIntegrationServer();

		// When I open a Spark notebook and run the cell
		let notebook = await sqlops.nb.showNotebookDocument(uri, {
			connectionId: connectionId
		});
		should(notebook.document.cells).have.length(1);
		let ran = await notebook.runCell(notebook.document.cells[0]);
		should(ran).be.true('Notebook runCell failed');

		// Then I expect to get the output result of 1+1, executed remotely against the Spark endpoint
		let cellOutputs = notebook.document.cells[0].contents.outputs;
		should(cellOutputs).have.length(4);
		let sparkResult = (<sqlops.nb.IStreamResult>cellOutputs[3]).text;
		should(sparkResult).equal('2');

		try {
			// TODO support closing the editor. Right now this prompts and there's no override for this. Need to fix in core
			// Close the editor using the recommended vscode API
			//await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
		catch (e) { }
	});
});

async function connectToSparkIntegrationServer(): Promise<string> {
	assert.ok(process.env.BACKEND_HOSTNAME, 'BACKEND_HOSTNAME, BACKEND_USERNAME, BACKEND_PWD must be set using ./tasks/setbackenvariables.sh or .\\tasks\\setbackendvaraibles.bat');
	let connInfo: sqlops.connection.Connection = {
		options: {
			'host': process.env.BACKEND_HOSTNAME,
			'groupId': 'C777F06B-202E-4480-B475-FA416154D458',
			'knoxport': '',
			'user': process.env.BACKEND_USERNAME,
			'password': process.env.BACKEND_PWD
		},
		providerName: 'HADOOP_KNOX',
		connectionId: 'abcd1234',
	};
	connInfo['savePassword'] = true;
	let result = await sqlops.connection.connect(<any>connInfo as sqlops.IConnectionProfile);

	should(result.connected).be.true();
	should(result.connectionId).not.be.undefined();
	should(result.connectionId).not.be.empty();
	should(result.errorMessage).be.undefined();

	let activeConnections = await sqlops.connection.getActiveConnections();
	should(activeConnections).have.length(1);

	return result.connectionId;
}

function writeNotebookToFile(pythonNotebook: INotebook): vscode.Uri {
	let notebookContentString = JSON.stringify(pythonNotebook);
	let localFile = tempWrite.sync(notebookContentString, 'notebook.ipynb');
	let uri = vscode.Uri.file(localFile);
	return uri;
}

async function ensureJupyterInstalled(): Promise<void> {
	let jupterControllerExports = vscode.extensions.getExtension('Microsoft.sql-vnext').exports;
	let jupyterController = jupterControllerExports.getJupterController() as JupyterController;
	await jupyterController.jupyterInstallation;
}


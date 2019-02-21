/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import * as os from 'os';
import * as nls from 'vscode-nls';

import { JupyterController } from './jupyter/jupyterController';
import { AppContext } from './common/appContext';
import { ApiWrapper } from './common/apiWrapper';

const localize = nls.loadMessageBundle();

const JUPYTER_NOTEBOOK_PROVIDER = 'jupyter';
const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', 'This sample code loads the file into a data frame and shows the first 10 results.');
const noNotebookVisible = localize('noNotebookVisible', 'No notebook editor is active');

let counter = 0;

export let controller: JupyterController;

export function activate(extensionContext: vscode.ExtensionContext) {
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.new', (connectionId?: string) => {
		newNotebook(connectionId);
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.open', () => {
		openNotebook();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.runactivecell', () => {
		runActiveCell();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addcode', () => {
		addCell('code');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addtext', () => {
		addCell('markdown');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.analyzeNotebook', (explorerContext: sqlops.ObjectExplorerContext) => {
		analyzeNotebook(explorerContext);
	}));

	let appContext = new AppContext(extensionContext, new ApiWrapper());
	controller = new JupyterController(appContext);
	controller.activate();
}

function newNotebook(connectionId: string) {
	let title = `Untitled-${counter++}`;
	let untitledUri = vscode.Uri.parse(`untitled:${title}`);
	let options: sqlops.nb.NotebookShowOptions = connectionId ? {
		viewColumn: null,
		preserveFocus: true,
		preview: null,
		providerId: null,
		connectionId: connectionId,
		defaultKernel: null
	} : null;
	sqlops.nb.showNotebookDocument(untitledUri, options).then(success => {

	}, (err: Error) => {
		vscode.window.showErrorMessage(err.message);
	});
}

async function openNotebook(): Promise<void> {
	try {
		let filter = {};
		// TODO support querying valid notebook file types
		filter[localize('notebookFiles', 'Notebooks')] = ['ipynb'];
		let file = await vscode.window.showOpenDialog({
			filters: filter
		});
		if (file) {
			let doc = await vscode.workspace.openTextDocument(file[0]);
			vscode.window.showTextDocument(doc);
		}
	} catch (err) {
		vscode.window.showErrorMessage(err);
	}
}

async function runActiveCell(): Promise<void> {
	try {
		let notebook = sqlops.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.runCell();
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(err);
	}
}

async function addCell(cellType: sqlops.nb.CellType): Promise<void> {
	try {
		let notebook = sqlops.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.edit((editBuilder: sqlops.nb.NotebookEditorEdit) => {
				// TODO should prompt and handle cell placement
				editBuilder.insertCell({
					cell_type: cellType,
					source: ''
				});
			});
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(err);
	}
}

async function analyzeNotebook(oeContext?: sqlops.ObjectExplorerContext): Promise<void> {
	// Ensure we get a unique ID for the notebook. For now we're using a different prefix to the built-in untitled files
	// to handle this. We should look into improving this in the future
	let untitledUri = vscode.Uri.parse(`untitled:Notebook-${counter++}`);

	let editor = await sqlops.nb.showNotebookDocument(untitledUri, {
		connectionId: oeContext ? oeContext.connectionProfile.id : '',
		providerId: JUPYTER_NOTEBOOK_PROVIDER,
		preview: false,
		defaultKernel: {
			name: 'pyspark3kernel',
			display_name: 'PySpark3',
			language: 'python'
		}
	});
	if (oeContext && oeContext.nodeInfo && oeContext.nodeInfo.nodePath) {
		// Get the file path after '/HDFS'
		let hdfsPath: string = oeContext.nodeInfo.nodePath.substring(oeContext.nodeInfo.nodePath.indexOf('/HDFS') + '/HDFS'.length);
		if (hdfsPath.length > 0) {
			let analyzeCommand = '#' + msgSampleCodeDataFrame + os.EOL + 'df = (spark.read.option("inferSchema", "true")'
				+ os.EOL + '.option("header", "true")' + os.EOL + '.csv("{0}"))' + os.EOL + 'df.show(10)';

			editor.edit(editBuilder => {
				editBuilder.replace(0, {
					cell_type: 'code',
					source: analyzeCommand.replace('{0}', hdfsPath)
				});
			});

		}
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (controller) {
		controller.deactivate();
	}
}

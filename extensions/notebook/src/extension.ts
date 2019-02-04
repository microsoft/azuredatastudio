/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

let counter = 0;
const notebookConfigKey = 'notebook';
const pythonPathConfigKey = 'pythonPath';
const DEFAULT_NOTEBOOK_PROVIDER = 'builtin';
const JUPYTER_NOTEBOOK_PROVIDER = 'jupyter';
const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', 'This sample code loads the file into a data frame and shows the first 10 results.');

export function activate(extensionContext: vscode.ExtensionContext) {
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.new', (connectionId?: string) => {
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
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.open', () => {
		openNotebook();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.analyzeNotebook', (explorerContext: sqlops.ObjectExplorerContext) => {
		analyzeNotebook(explorerContext);
	}));

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

async function analyzeNotebook(oeContext?: sqlops.ObjectExplorerContext): Promise<void> {
	// Ensure we get a unique ID for the notebook. For now we're using a different prefix to the built-in untitled files
	// to handle this. We should look into improving this in the future
	let untitledUri = vscode.Uri.parse(`untitled:Notebook-${counter++}`);

	let config = getConfiguration(notebookConfigKey);
	if (config) {
		let providerId: string = JUPYTER_NOTEBOOK_PROVIDER;

		let pythonInstalledPath = config[pythonPathConfigKey];
		if (!(pythonInstalledPath && fs.existsSync(pythonInstalledPath))) {
			providerId = DEFAULT_NOTEBOOK_PROVIDER;
		}

		let editor = await sqlops.nb.showNotebookDocument(untitledUri, {
			connectionId: oeContext ? oeContext.connectionProfile.id : '',
			providerId: providerId
		});
		if (oeContext && oeContext.nodeInfo && oeContext.nodeInfo.nodePath) {
			// Get the file path after '/HDFS'
			let hdfsPath: string = oeContext.nodeInfo.nodePath.substring(oeContext.nodeInfo.nodePath.indexOf('/HDFS') + '/HDFS'.length);
			if (hdfsPath.length > 0) {
				let analyzeCommand = "#" + msgSampleCodeDataFrame + os.EOL + "df = (spark.read.option(\"inferSchema\", \"true\")"
					+ os.EOL + ".option(\"header\", \"true\")" + os.EOL + ".csv('{0}'))" + os.EOL + "df.show(10)";

				editor.edit(editBuilder => {
					editBuilder.replace(0, {
						cell_type: 'code',
						source: analyzeCommand.replace('{0}', hdfsPath)
					});
				});

			}
		}
	}
}

/**
	* Get the configuration for a extensionName
	* @param extensionName The string name of the extension to get the configuration for
	* @param resource The optional URI, as a URI object or a string, to use to get resource-scoped configurations
	*/
function getConfiguration(extensionName?: string, resource?: vscode.Uri | string): vscode.WorkspaceConfiguration {
	if (typeof resource === 'string') {
		try {
			resource = this.parseUri(resource);
		} catch (e) {
			resource = undefined;
		}
	} else if (!resource) {
		// Fix to avoid adding lots of errors to debug console. Expects a valid resource or null, not undefined
		resource = null;
	}
	return vscode.workspace.getConfiguration(extensionName, resource as vscode.Uri);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

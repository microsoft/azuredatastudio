/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as path from 'path';

import * as Constants from './constants';
import ContextProvider from './contextProvider';
import * as Utils from './utils';
import { AppContext } from './appContext';
import { IExtension } from './azuremonitor';
import { AzureMonitorObjectExplorerNodeProvider } from './objectExplorerNodeProvider/objectExplorerNodeProvider';
import { registerSearchServerCommand } from './objectExplorerNodeProvider/command';
import { AzureMonitorIconProvider } from './iconProvider';
import { createAzureMonitorApi } from './azuremonitorApiFactory';
import { AzureMonitorServer } from './azuremonitorServer';
import { promises as fs } from 'fs';

const localize = nls.loadMessageBundle();

export async function activate(context: vscode.ExtensionContext): Promise<IExtension | undefined> {
	// lets make sure we support this platform first
	let supported = await Utils.verifyPlatform();

	if (!supported) {
		vscode.window.showErrorMessage(localize('azuremonitor.unsupportedPlatform', 'Unsupported platform'));
		return undefined;
	}

	// ensure our log path exists
	if (!(await Utils.exists(context.logPath))) {
		await fs.mkdir(context.logPath);
	}

	let appContext = new AppContext(context);

	let nodeProvider = new AzureMonitorObjectExplorerNodeProvider(appContext);
	azdata.dataprotocol.registerObjectExplorerNodeProvider(nodeProvider);
	let iconProvider = new AzureMonitorIconProvider();
	azdata.dataprotocol.registerIconProvider(iconProvider);

	registerTasks();

	registerSearchServerCommand();
	context.subscriptions.push(new ContextProvider());

	registerLogCommand(context);

	// initialize client last so we don't have features stuck behind it
	const server = new AzureMonitorServer();
	context.subscriptions.push(server);
	await server.start(appContext);

	return createAzureMonitorApi(appContext);
}

const logFiles = ['resourceprovider.log', 'azuremonitorservice.log', 'credentialstore.log'];
function registerLogCommand(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('azuremonitor.showLogFile', async () => {
		const choice = await vscode.window.showQuickPick(logFiles);
		if (choice) {
			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(context.logPath, choice)));
			if (document) {
				vscode.window.showTextDocument(document);
			}
		}
	}));
}

function registerTasks(): void {
	azdata.tasks.registerTask(Constants.azuremonitorClusterNewNotebookTask, (profile: azdata.IConnectionProfile) => {
		return saveProfileAndCreateNotebook(profile);
	});
	azdata.tasks.registerTask(Constants.azuremonitorClusterOpenNotebookTask, (profile: azdata.IConnectionProfile) => {
		return handleOpenNotebookTask(profile);
	});
}

function saveProfileAndCreateNotebook(profile: azdata.IConnectionProfile): Promise<void> {
	return handleNewNotebookTask(undefined, profile);
}

function findNextUntitledEditorName(): string {
	let nextVal = 0;
	// Note: this will go forever if it's coded wrong, or you have inifinite Untitled notebooks!
	while (true) {
		let title = `Notebook-${nextVal}`;
		let hasNotebookDoc = azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1;
		if (!hasNotebookDoc) {
			return title;
		}
		nextVal++;
	}
}

async function handleNewNotebookTask(_oeContext?: azdata.ObjectExplorerContext, profile?: azdata.IConnectionProfile): Promise<void> {
	// Ensure we get a unique ID for the notebook. For now we're using a different prefix to the built-in untitled files
	// to handle this. We should look into improving this in the future
	let title = findNextUntitledEditorName();
	let untitledUri = vscode.Uri.parse(`untitled:${title}`);
	await azdata.nb.showNotebookDocument(untitledUri, {
		connectionProfile: profile,
		preview: false
	});
}

async function handleOpenNotebookTask(profile: azdata.IConnectionProfile): Promise<void> {
	let notebookFileTypeName = localize('notebookFileType', "Notebooks");
	let filter: any = {};
	filter[notebookFileTypeName] = 'ipynb';
	let uris = await vscode.window.showOpenDialog({
		filters: filter,
		canSelectFiles: true,
		canSelectMany: false
	});
	if (uris && uris.length > 0) {
		let fileUri = uris[0];
		// Verify this is a .ipynb file since this isn't actually filtered on Mac/Linux
		if (path.extname(fileUri.fsPath) !== '.ipynb') {
			// in the future might want additional supported types
			vscode.window.showErrorMessage(localize('unsupportedFileType', "Only .ipynb Notebooks are supported"));
		} else {
			await azdata.nb.showNotebookDocument(fileUri, {
				connectionProfile: profile,
				preview: false
			});
		}
	}
}

// this method is called when your extension is deactivated
export function deactivate(): void {
}

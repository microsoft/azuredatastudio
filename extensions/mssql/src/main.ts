/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';

import * as Constants from './constants';
import ContextProvider from './contextProvider';
import * as Utils from './utils';
import { AppContext } from './appContext';
import { IExtension } from 'mssql';
import { MssqlIconProvider } from './iconProvider';
import { getBookExtensionContributions } from './dashboard/bookExtensions';
import { registerBooksWidget } from './dashboard/bookWidget';
import { createMssqlApi } from './mssqlApiFactory';
import { SqlToolsServer } from './sqlToolsServer';
import { promises as fs } from 'fs';
import { IconPathHelper } from './iconHelper';
import * as nls from 'vscode-nls';
import { INotebookConvertService } from './notebookConvert/notebookConvertService';
import { registerTableDesignerCommands } from './tableDesigner/tableDesigner';

const localize = nls.loadMessageBundle();

export async function activate(context: vscode.ExtensionContext): Promise<IExtension> {
	// lets make sure we support this platform first
	let supported = await Utils.verifyPlatform();

	if (!supported) {
		void vscode.window.showErrorMessage('Unsupported platform');
		return undefined;
	}

	// ensure our log path exists
	if (!(await Utils.exists(context.logPath))) {
		await fs.mkdir(context.logPath);
	}

	IconPathHelper.setExtensionContext(context);

	let appContext = new AppContext(context);

	let iconProvider = new MssqlIconProvider();
	azdata.dataprotocol.registerIconProvider(iconProvider);

	registerSearchServerCommand();
	context.subscriptions.push(new ContextProvider());

	registerLogCommand(context);

	// Get book contributions - in the future this will be integrated with the Books/Notebook widget to show as a dashboard widget
	const bookContributionProvider = getBookExtensionContributions(context);
	context.subscriptions.push(bookContributionProvider);

	registerBooksWidget(bookContributionProvider);

	// initialize client last so we don't have features stuck behind it
	const server = new SqlToolsServer();
	context.subscriptions.push(server);
	await server.start(appContext);

	vscode.commands.registerCommand('mssql.exportSqlAsNotebook', async (uri: vscode.Uri) => {
		try {
			const result = await appContext.getService<INotebookConvertService>(Constants.NotebookConvertService).convertSqlToNotebook(uri.toString());
			const title = findNextUntitledEditorName();
			const untitledUri = vscode.Uri.parse(`untitled:${title}`);
			await azdata.nb.showNotebookDocument(untitledUri, { initialContent: result.content });
		} catch (err) {
			void vscode.window.showErrorMessage(localize('mssql.errorConvertingToNotebook', "An error occurred converting the SQL document to a Notebook. Error : {0}", err.toString()));
		}
	});

	vscode.commands.registerCommand('mssql.exportNotebookToSql', async (uri: vscode.Uri) => {
		try {
			// SqlToolsService doesn't currently store anything about Notebook documents so we have to pass the raw JSON to it directly
			// We use vscode.workspace.textDocuments here because the azdata.nb.notebookDocuments don't actually contain their contents
			// (they're left out for perf purposes)
			const doc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
			const result = await appContext.getService<INotebookConvertService>(Constants.NotebookConvertService).convertNotebookToSql(doc.getText());
			await azdata.queryeditor.openQueryDocument({ content: result.content });
		} catch (err) {
			void vscode.window.showErrorMessage(localize('mssql.errorConvertingToSQL', "An error occurred converting the Notebook document to SQL. Error : {0}", err.toString()));
		}
	});

	registerTableDesignerCommands(appContext);

	return createMssqlApi(appContext, server);
}

const logFiles = ['resourceprovider.log', 'sqltools.log', 'credentialstore.log'];
function registerLogCommand(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('mssql.showLogFile', async () => {
		const choice = await vscode.window.showQuickPick(logFiles);
		if (choice) {
			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(context.logPath, choice)));
			if (document) {
				void vscode.window.showTextDocument(document);
			}
		}
	}));
}

function registerSearchServerCommand(): void {
	vscode.commands.registerCommand('mssql.searchServers', () => {
		void vscode.window.showInputBox({
			placeHolder: localize('mssql.searchServers', "Search Server Names")
		}).then((stringSearch) => {
			if (stringSearch) {
				void vscode.commands.executeCommand('registeredServers.searchServer', (stringSearch));
			}
		});
	});
	vscode.commands.registerCommand('mssql.clearSearchServerResult', () => {
		void vscode.commands.executeCommand('registeredServers.clearSearchServerResult');
	});
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

// this method is called when your extension is deactivated
export function deactivate(): void {
}

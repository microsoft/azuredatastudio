/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import * as os from 'os';

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
// import { SqlNotebookController } from './sqlNotebook/sqlNotebookController';
import { registerObjectManagementCommands } from './objectManagement/commands';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from './telemetry';
import { TelemetryEventMeasures } from '@microsoft/ads-extension-telemetry';
import { noConvertResult, noDocumentFound, unsupportedPlatform } from './localizedConstants';
import { registerConnectionCommands } from './connection/commands';

const localize = nls.loadMessageBundle();

export async function activate(context: vscode.ExtensionContext): Promise<IExtension> {
	// lets make sure we support this platform first
	let supported = await Utils.verifyPlatform();

	if (!supported) {
		const msg = unsupportedPlatform(os.platform());
		void vscode.window.showErrorMessage(msg);
		throw new Error(unsupportedPlatform(msg));
	}

	// ensure our log path exists
	if (!(await Utils.exists(context.logUri.fsPath))) {
		await fs.mkdir(context.logUri.fsPath);
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

	context.subscriptions.push(vscode.commands.registerCommand('mssql.exportSqlAsNotebook', async (uri: vscode.Uri) => {
		try {
			const result = await appContext.getService<INotebookConvertService>(Constants.NotebookConvertService).convertSqlToNotebook(uri.toString());
			if (!result) {
				throw new Error(noConvertResult);
			}
			const title = findNextUntitledEditorName();
			const untitledUri = vscode.Uri.parse(`untitled:${title}`);
			await azdata.nb.showNotebookDocument(untitledUri, { initialContent: result.content });
		} catch (err) {
			void vscode.window.showErrorMessage(localize('mssql.errorConvertingToNotebook', "An error occurred converting the SQL document to a Notebook. Error : {0}", err.toString()));
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mssql.exportNotebookToSql', async (uri: vscode.Uri) => {
		try {
			// SqlToolsService doesn't currently store anything about Notebook documents so we have to pass the raw JSON to it directly
			// We use vscode.workspace.textDocuments here because the azdata.nb.notebookDocuments don't actually contain their contents
			// (they're left out for perf purposes)
			const doc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
			if (!doc) {
				throw new Error(noDocumentFound(uri.toString()));
			}
			const result = await appContext.getService<INotebookConvertService>(Constants.NotebookConvertService).convertNotebookToSql(doc.getText());
			if (!result) {
				throw new Error(noConvertResult);
			}
			await azdata.queryeditor.openQueryDocument({ content: result.content });
		} catch (err) {
			void vscode.window.showErrorMessage(localize('mssql.errorConvertingToSQL', "An error occurred converting the Notebook document to SQL. Error : {0}", err.toString()));
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand(Constants.cmdObjectExplorerEnableGroupBySchemaCommand, async () => {
		TelemetryReporter.sendActionEvent(TelemetryViews.MssqlObjectExplorer, TelemetryActions.EnableGroupBySchemaContextMenu)
		await vscode.workspace.getConfiguration().update(Constants.configObjectExplorerGroupBySchemaFlagName, true, true);
	}));

	context.subscriptions.push(vscode.commands.registerCommand(Constants.cmdObjectExplorerDisableGroupBySchemaCommand, async () => {
		TelemetryReporter.sendActionEvent(TelemetryViews.MssqlObjectExplorer, TelemetryActions.DisableGroupBySchemaContextMenu)
		await vscode.workspace.getConfiguration().update(Constants.configObjectExplorerGroupBySchemaFlagName, false, true);
	}));

	context.subscriptions.push(vscode.commands.registerCommand(Constants.cmdObjectExplorerEnabbleGroupBySchemaTitleCommand, async () => {
		TelemetryReporter.sendActionEvent(TelemetryViews.MssqlObjectExplorer, TelemetryActions.EnableGroupByServerViewTitleAction)
		await vscode.workspace.getConfiguration().update(Constants.configObjectExplorerGroupBySchemaFlagName, true, true);
	}));

	context.subscriptions.push(vscode.commands.registerCommand(Constants.cmdObjectExplorerDisableGroupBySchemaTitleCommand, async () => {
		TelemetryReporter.sendActionEvent(TelemetryViews.MssqlObjectExplorer, TelemetryActions.DisableGroupByServerViewTitleAction)
		await vscode.workspace.getConfiguration().update(Constants.configObjectExplorerGroupBySchemaFlagName, false, true);
	}));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
		if (e.affectsConfiguration(Constants.configObjectExplorerGroupBySchemaFlagName)) {
			const groupBySchemaTelemetryActionEvent = vscode.workspace.getConfiguration().get(Constants.configObjectExplorerGroupBySchemaFlagName) ? TelemetryActions.GroupBySchemaEnabled : TelemetryActions.GroupBySchemaDisabled;
			TelemetryReporter.sendActionEvent(TelemetryViews.MssqlObjectExplorer, groupBySchemaTelemetryActionEvent);
			const activeConnections = await azdata.objectexplorer.getActiveConnectionNodes();
			const connections = await azdata.connection.getConnections();
			activeConnections.forEach(async node => {
				const connectionProfile = connections.find(c => c.connectionId === node.connectionId);
				if (connectionProfile?.providerId === Constants.providerId) {
					await node.refresh();
				}
			});
		}
		if (e.affectsConfiguration(Constants.configParallelMessageProcessingName)) {
			if (Utils.getParallelMessageProcessingConfig()) {
				TelemetryReporter.sendActionEvent(TelemetryViews.MssqlConnections, TelemetryActions.EnableFeatureAsyncParallelProcessing);
			}
			await displayReloadAds();
		}
		if (Utils.getParallelMessageProcessingConfig() && e.affectsConfiguration(Constants.configParallelMessageProcessingLimitName)) {
			let additionalMeasurements: TelemetryEventMeasures;
			additionalMeasurements.parallelMessageProcessingLimit = Utils.getParallelMessageProcessingLimitConfig()
			TelemetryReporter.sendMetricsEvent(additionalMeasurements, Constants.configParallelMessageProcessingLimitName);
			await displayReloadAds();
		}
		if (e.affectsConfiguration(Constants.configEnableSqlAuthenticationProviderName)) {
			if (Utils.getEnableSqlAuthenticationProviderConfig()) {
				TelemetryReporter.sendActionEvent(TelemetryViews.MssqlConnections, TelemetryActions.EnableFeatureSqlAuthenticationProvider);
			}
			await displayReloadAds();
		}
		if (e.affectsConfiguration(Constants.configEnableConnectionPoolingName)) {
			if (Utils.getEnableConnectionPoolingConfig()) {
				TelemetryReporter.sendActionEvent(TelemetryViews.MssqlConnections, TelemetryActions.EnableFeatureConnectionPooling);
			}
			await displayReloadAds();
		}
		// Prompt to reload ADS as we send the proxy URL to STS to instantiate Http Client instances.
		if (e.affectsConfiguration(Constants.configHttpProxy) || e.affectsConfiguration(Constants.configHttpProxyStrictSSL)) {
			await displayReloadAds();
		}
	}));

	registerTableDesignerCommands(appContext);
	registerObjectManagementCommands(appContext);
	registerConnectionCommands(appContext);

	// context.subscriptions.push(new SqlNotebookController()); Temporarily disabled due to breaking query editor

	context.subscriptions.push(TelemetryReporter);
	return createMssqlApi(appContext, server);
}

/**
 * Display notification with action to reload ADS
 * @returns true if button is clicked, false otherwise.
 */
async function displayReloadAds(): Promise<boolean> {
	const reloadPrompt = localize('mssql.reloadPrompt', "This setting requires Azure Data Studio to be reloaded to take into effect.");
	const reloadChoice = localize('mssql.reloadChoice', "Reload Azure Data Studio");
	const result = await vscode.window.showInformationMessage(reloadPrompt, reloadChoice);
	if (result === reloadChoice) {
		await vscode.commands.executeCommand('workbench.action.reloadWindow');
		return true;
	} else {
		return false;
	}
}

const logFiles = ['resourceprovider.log', 'sqltools.log', 'credentialstore.log'];
function registerLogCommand(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('mssql.showLogFile', async () => {
		const choice = await vscode.window.showQuickPick(logFiles);
		if (choice) {
			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(context.logUri.fsPath, choice)));
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

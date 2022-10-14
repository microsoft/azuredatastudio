/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DOUBLE_CLICK_ACTION_CONFIG_SECTION, ITEM_SELECTED_COMMAND_ID, QUERY_HISTORY_CONFIG_SECTION } from './constants';
import { QueryHistoryItem } from './queryHistoryItem';
import { QueryHistoryProvider, setLoadingContext } from './queryHistoryProvider';
import { promises as fs } from 'fs';
import { sendSettingChangedEvent, TelemetryActions, TelemetryReporter, TelemetryViews } from './telemetry';

type DoubleClickAction = 'open' | 'run';

const DEFAULT_DOUBLECLICK_ACTION: DoubleClickAction = 'open';
let doubleClickAction: string = DEFAULT_DOUBLECLICK_ACTION;

let lastSelectedItem: { item: QueryHistoryItem | undefined, time: number | undefined } = {
	item: undefined,
	time: undefined
};
/**
 * The time in ms between clicks to count as a double click on our tree view items
 */
const DOUBLE_CLICK_TIMEOUT_MS = 500;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// Create the global storage folder now for storing the query history persistance file
	const storageUri = context.globalStorageUri;
	try {
		await fs.mkdir(storageUri.fsPath);
	} catch (err) {
		if (err.code !== 'EEXIST') {
			TelemetryReporter.sendErrorEvent(TelemetryViews.QueryHistory, 'CreatingStorageFolder');
			console.error(`Error creating query history global storage folder ${context.globalStorageUri.fsPath}. ${err}`);
		}
	}
	await setLoadingContext(true);
	const treeDataProvider = new QueryHistoryProvider(context, storageUri);
	context.subscriptions.push(treeDataProvider);
	const treeView = vscode.window.createTreeView('queryHistory', {
		treeDataProvider,
		canSelectMany: false
	});
	context.subscriptions.push(treeView);
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
		if (e.affectsConfiguration(`${QUERY_HISTORY_CONFIG_SECTION}.${DOUBLE_CLICK_ACTION_CONFIG_SECTION}`)) {
			const newDoubleClickAction = getDoubleClickAction();
			if (newDoubleClickAction !== doubleClickAction) {
				sendSettingChangedEvent('DoubleClickAction', doubleClickAction, newDoubleClickAction);
			}
			doubleClickAction = newDoubleClickAction;
		}
	}));
	// This is an internal-only command so not adding to package.json
	context.subscriptions.push(vscode.commands.registerCommand(ITEM_SELECTED_COMMAND_ID, async (selectedItem: QueryHistoryItem) => {
		// VS Code doesn't provide a native way to detect a double-click so we track it ourselves by keeping track of the last item clicked and
		// when it was clicked to compare, then if a click happens on the same element quickly enough we trigger the configured action
		const clickTime = new Date().getTime();
		if (lastSelectedItem.item === selectedItem && lastSelectedItem.time && (clickTime - lastSelectedItem.time) < DOUBLE_CLICK_TIMEOUT_MS) {
			TelemetryReporter.sendActionEvent(TelemetryViews.QueryHistory, TelemetryActions.DoubleClick, doubleClickAction);
			switch (doubleClickAction) {
				case 'run':
					await runQuery(selectedItem);
					break;
				case 'open':
				default:
					await openQuery(selectedItem);
					break;
			}
			// Clear out the last selected item so we don't run the command again on a 3rd click
			lastSelectedItem = {
				item: undefined,
				time: undefined
			};
		} else {
			// Update the last selected item since we didn't run a command
			lastSelectedItem = {
				item: selectedItem,
				time: clickTime
			};
		}

	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.open', async (item: QueryHistoryItem) => {
		return openQuery(item);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.run', async (item: QueryHistoryItem) => {
		return runQuery(item);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.delete', (item: QueryHistoryItem) => {
		return treeDataProvider.deleteItem(item);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.clear', () => {
		return treeDataProvider.clearAll();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.disableCapture', async () => {
		return treeDataProvider.setCaptureEnabled(false);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.enableCapture', async () => {
		return treeDataProvider.setCaptureEnabled(true);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.openStorageFolder', async () => {
		return vscode.env.openExternal(storageUri);
	}));
}

async function openQuery(item: QueryHistoryItem): Promise<void> {
	try {
		await azdata.queryeditor.openQueryDocument(
			{
				content: item.queryText
			}, item.connectionProfile?.providerId);
	} catch (err) {
		TelemetryReporter.sendErrorEvent(TelemetryViews.QueryHistory, 'OpenQuery');
	}

}

async function runQuery(item: QueryHistoryItem): Promise<void> {
	let step = 'OpenDoc';
	try {
		const doc = await azdata.queryeditor.openQueryDocument(
			{
				content: item.queryText
			}, item.connectionProfile?.providerId);
		if (item.connectionProfile) {
			step = 'ConnectWithProfile';
			await doc.connect(item.connectionProfile);
		} else {
			step = 'ConnectWithoutProfile';
			await azdata.queryeditor.connect(doc.uri, '');
		}
		step = 'Run';
		azdata.queryeditor.runQuery(doc.uri);
	} catch (err) {
		TelemetryReporter.createErrorEvent(TelemetryViews.QueryHistory, 'RunQuery')
			.withAdditionalProperties({ step })
			.send();
	}
}

export function getDoubleClickAction(): string {
	return vscode.workspace.getConfiguration(QUERY_HISTORY_CONFIG_SECTION).get<string>(DOUBLE_CLICK_ACTION_CONFIG_SECTION, DEFAULT_DOUBLECLICK_ACTION);
}

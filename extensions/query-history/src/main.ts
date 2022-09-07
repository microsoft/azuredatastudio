/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DOUBLE_CLICK_ACTION_CONFIG_SECTION, ITEM_SELECTED_COMMAND_ID, QUERY_HISTORY_CONFIG_SECTION } from './constants';
import { QueryHistoryItem } from './queryHistoryItem';
import { QueryHistoryProvider } from './queryHistoryProvider';
import { promises as fs } from 'fs';

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
	try {
		await fs.mkdir(context.globalStorageUri.fsPath);
	} catch (err) {
		if (err.code !== 'EEXIST') {
			console.error(`Error creating query history global storage folder ${context.globalStorageUri.fsPath}. ${err}`);
		}
	}
	const treeDataProvider = new QueryHistoryProvider(context);
	context.subscriptions.push(treeDataProvider);
	const treeView = vscode.window.createTreeView('queryHistory', {
		treeDataProvider,
		canSelectMany: false
	});
	context.subscriptions.push(treeView);
	// This is an internal-only command so not adding to package.json
	context.subscriptions.push(vscode.commands.registerCommand(ITEM_SELECTED_COMMAND_ID, async (selectedItem: QueryHistoryItem) => {
		// VS Code doesn't provide a native way to detect a double-click so we track it ourselves by keeping track of the last item clicked and
		// when it was clicked to compare, then if a click happens on the same element quickly enough we trigger the configured action
		const clickTime = new Date().getTime();
		if (lastSelectedItem.item === selectedItem && lastSelectedItem.time && (clickTime - lastSelectedItem.time) < DOUBLE_CLICK_TIMEOUT_MS) {
			const doubleClickAction = vscode.workspace.getConfiguration(QUERY_HISTORY_CONFIG_SECTION).get<string>(DOUBLE_CLICK_ACTION_CONFIG_SECTION);
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
}

async function openQuery(item: QueryHistoryItem): Promise<void> {
	await azdata.queryeditor.openQueryDocument(
		{
			content: item.queryText
		}, item.connectionProfile?.providerId);
}

async function runQuery(item: QueryHistoryItem): Promise<void> {
	const doc = await azdata.queryeditor.openQueryDocument(
		{
			content: item.queryText
		}, item.connectionProfile?.providerId);
	await azdata.queryeditor.connect(doc.uri, item.connectionProfile?.connectionId || '');
	azdata.queryeditor.runQuery(doc.uri);
}

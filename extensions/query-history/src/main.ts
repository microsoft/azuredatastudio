/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { QueryHistoryItem } from './queryHistoryItem';
import { QueryHistoryProvider } from './queryHistoryProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const provider = new QueryHistoryProvider();
	context.subscriptions.push(provider);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('queryHistory', provider));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.open', async (item: QueryHistoryItem) => {
		return azdata.queryeditor.openQueryDocument(
			{
				content: item.queryText
			}, item.connectionProfile?.providerId);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.run', async (item: QueryHistoryItem) => {
		const doc = await azdata.queryeditor.openQueryDocument(
			{
				content: item.queryText
			}, item.connectionProfile?.providerId);
		await azdata.queryeditor.connect(doc.uri, item.connectionProfile?.connectionId || '');
		azdata.queryeditor.runQuery(doc.uri);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.delete', (item: QueryHistoryItem) => {
		provider.deleteItem(item);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.clear', () => {
		provider.clearAll();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.disableCapture', async () => {
		return provider.setCaptureEnabled(false);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.enableCapture', async () => {
		return provider.setCaptureEnabled(true);
	}));
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { QueryHistoryNode } from './queryHistoryNode';
import { QueryHistoryProvider } from './queryHistoryProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const provider = new QueryHistoryProvider();
	context.subscriptions.push(provider);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('queryHistory', provider));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.open', async (node: QueryHistoryNode) => {
		return azdata.queryeditor.openQueryDocument(
			{
				content: node.queryText
			}, node.connectionProfile?.providerId);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.run', async (node: QueryHistoryNode) => {
		const doc = await azdata.queryeditor.openQueryDocument(
			{
				content: node.queryText
			}, node.connectionProfile?.providerId);
		await azdata.queryeditor.connect(doc.uri, node.connectionProfile?.connectionId || '');
		azdata.queryeditor.runQuery(doc.uri);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('queryHistory.delete', (node: QueryHistoryNode) => {
		provider.deleteNode(node);
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

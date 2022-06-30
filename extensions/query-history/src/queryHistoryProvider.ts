/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { EOL } from 'os';
import { QueryHistoryNode } from './queryHistoryNode';

const QUERY_HISTORY_CONFIG_SECTION = 'queryHistory';
const CAPTURE_ENABLED_CONFIG_SECTION = 'captureEnabled';
const DEFAULT_CAPTURE_ENABLED = true;

export class QueryHistoryProvider implements vscode.TreeDataProvider<QueryHistoryNode>, vscode.Disposable {

	private _onDidChangeTreeData: vscode.EventEmitter<QueryHistoryNode | undefined> = new vscode.EventEmitter<QueryHistoryNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<QueryHistoryNode | undefined> = this._onDidChangeTreeData.event;

	private _queryHistoryNodes: QueryHistoryNode[] = [];
	private _captureEnabled: boolean = true;

	private _disposables: vscode.Disposable[] = [];

	constructor() {
		this._disposables.push(azdata.queryeditor.registerQueryEventListener({
			onQueryEvent: async (type: azdata.queryeditor.QueryEventType, document: azdata.queryeditor.QueryDocument, args: azdata.ResultSetSummary | string | undefined, queryInfo?: azdata.queryeditor.QueryInfo) => {
				if (this._captureEnabled && queryInfo && type === 'queryStop') {
					const textDocuments = vscode.workspace.textDocuments;
					// We need to compare URIs, but the event Uri comes in as string so while it should be in the same format as
					// the textDocument uri.toString() we parse it into a vscode.Uri first to be absolutely sure.
					const textDocument = textDocuments.find(e => e.uri.toString() === vscode.Uri.parse(document.uri).toString());
					if (!textDocument) {
						// If we couldn't find the document then we can't get the text so just log the error and move on
						console.error(`Couldn't find text document with URI ${document.uri} for query event`);
						return;
					}
					// Combine all the text from the batches back together
					const queryText = queryInfo.batchRanges.map(r => textDocument.getText(r) ?? '').join(EOL);
					const connProfile = await azdata.connection.getConnection(document.uri);
					const isError = queryInfo.messages.find(m => m.isError) ? false : true;
					// Add to the front of the list so the new item appears at the top
					this._queryHistoryNodes.unshift(new QueryHistoryNode(queryText, connProfile, new Date(), isError));
					this._onDidChangeTreeData.fire(undefined);
				}
			}
		}));
		this.updateCaptureEnabled();
		this._disposables.push(vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(QUERY_HISTORY_CONFIG_SECTION)) {
				this.updateCaptureEnabled();
			}
		}));
	}

	public clearAll(): void {
		this._queryHistoryNodes = [];
		this._onDidChangeTreeData.fire(undefined);
	}

	public deleteNode(node: QueryHistoryNode): void {
		this._queryHistoryNodes = this._queryHistoryNodes.filter(n => n !== node);
		this._onDidChangeTreeData.fire(undefined);
	}
	public getTreeItem(node: QueryHistoryNode): vscode.TreeItem {
		return node;
	}

	public getChildren(element?: QueryHistoryNode): QueryHistoryNode[] {
		// We only have top level items
		return this._queryHistoryNodes;
	}

	public dispose(): void {
		this._disposables.forEach(d => d.dispose());
	}

	private updateCaptureEnabled(): void {
		this._captureEnabled = vscode.workspace.getConfiguration(QUERY_HISTORY_CONFIG_SECTION).get(CAPTURE_ENABLED_CONFIG_SECTION) ?? DEFAULT_CAPTURE_ENABLED;
	}

	/**
	 * Set whether query history capture is currently enabled
	 * @param enabled Whether capture is currently enabled
	 * @returns A promise that resolves when the value is updated and persisted to configuration
	 */
	public async setCaptureEnabled(enabled: boolean): Promise<void> {
		this._captureEnabled = enabled;
		return vscode.workspace.getConfiguration(QUERY_HISTORY_CONFIG_SECTION).update(CAPTURE_ENABLED_CONFIG_SECTION, this._captureEnabled, vscode.ConfigurationTarget.Global);
	}
}

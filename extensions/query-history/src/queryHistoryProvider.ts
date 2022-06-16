/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { QueryHistoryNode } from './queryHistoryNode';

const QueryHistoryConfigSection = 'queryHistory';
const CaptureEnabledConfigSection = 'captureEnabled';

export class QueryHistoryProvider implements vscode.TreeDataProvider<QueryHistoryNode>, vscode.Disposable {

	private _onDidChangeTreeData: vscode.EventEmitter<QueryHistoryNode | undefined> = new vscode.EventEmitter<QueryHistoryNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<QueryHistoryNode | undefined> = this._onDidChangeTreeData.event;

	private _queryHistoryNodes: QueryHistoryNode[] = [];
	private _captureEnabled: boolean = true;
	// private _queryHistoryLimit: number = 10;

	private _disposables: vscode.Disposable[] = [];

	constructor() {
		this._disposables.push(azdata.queryeditor.registerQueryEventListener({
			onQueryEvent: async (type: azdata.queryeditor.QueryEventType, document: azdata.queryeditor.QueryDocument, args: azdata.ResultSetSummary | string | undefined, queryInfo?: azdata.queryeditor.IQueryInfo) => {
				if (this._captureEnabled && queryInfo && type === 'queryStop') {
					const queryText = queryInfo.query ?? '';
					const connProfile = await azdata.connection.getConnection(document.uri);
					const isError = queryInfo.messages.find(m => m.isError) ? false : true;
					this._queryHistoryNodes.unshift(new QueryHistoryNode(queryText, connProfile?.connectionId ?? '', connProfile.providerId, '', new Date(), isError));
					this._onDidChangeTreeData.fire(undefined);
				}
			}
		}));
		this._captureEnabled = vscode.workspace.getConfiguration(QueryHistoryConfigSection).get(CaptureEnabledConfigSection) ?? true;
		// const config = this._vscodeWrapper.getConfiguration(Constants.extensionConfigSectionName);
		// this._queryHistoryLimit = config.get(Constants.configQueryHistoryLimit);
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

	/**
	 * Set whether query history capture is currently enabled
	 * @param enabled Whether capture is currently enabled
	 * @returns A promise that resolves when the value is updated and persisted to configuration
	 */
	public async setCaptureEnabled(enabled: boolean): Promise<void> {
		this._captureEnabled = enabled;
		return vscode.workspace.getConfiguration(QueryHistoryConfigSection).update(CaptureEnabledConfigSection, this._captureEnabled, vscode.ConfigurationTarget.Global);
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { SqlDatabaseProjectItem } from './databaseProjectTreeItem';
import { Deferred } from '../common/promise';

export class SqlDatabaseProjectTreeViewProvider implements vscode.TreeDataProvider<SqlDatabaseProjectItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<SqlDatabaseProjectItem | undefined> = new vscode.EventEmitter<SqlDatabaseProjectItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<SqlDatabaseProjectItem | undefined> = this._onDidChangeTreeData.event;

	private _initializeDeferred: Deferred<void> = new Deferred<void>();

	getTreeItem(element: any): vscode.TreeItem | Thenable<vscode.TreeItem> {
		throw new Error('Method not implemented.  ' + element);
	}
	getChildren(element?: any): vscode.ProviderResult<any[]> {
		throw new Error('Method not implemented.  ' + element);
	}

	public get initialized(): Promise<void> {
		return this._initializeDeferred.promise;
	}
}

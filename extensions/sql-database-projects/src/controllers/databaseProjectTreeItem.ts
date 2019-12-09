/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class SqlDatabaseProjectItem extends vscode.TreeItem {
	readonly fileName: string;
	readonly children: SqlDatabaseProjectItem[];

	constructor(fileName: string, children: SqlDatabaseProjectItem[]) {
		super(fileName);

		this.fileName = fileName;
		this.children = children;

		this.collapsibleState = this.children.length === 0 ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded;
	}
}

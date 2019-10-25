/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as mssql from '../../../mssql/src/mssql';

export interface TreeItemFormat {
	title: string;
	type: string;
}

export class TreeItem extends vscode.TreeItem{
	public parent: TreeItem;
	public children: TreeItem[];
	public nodeType: string;
	public command: vscode.Command;
	public nodeLabel: string;
	public treeItem: any;
	public treeNode: any;
	public nodeInfo: any;
	public tooltip: string;

	constructor(public book: TreeItemFormat, parent: TreeItem, icons: any) {
		super(book.title, 1);
		this.nodeType = book.type;
		this.parent = parent;
		this.children = [];
	}
}

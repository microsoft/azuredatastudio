/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Base class for an item that appears in the ADS project tree
 */
export abstract class BaseProjectTreeItem {
	uri: vscode.Uri;
	parent?: BaseProjectTreeItem;

	constructor(uri: vscode.Uri, parent?: BaseProjectTreeItem) {
		this.uri = uri;
		this.parent = parent;
	}

	abstract get children(): BaseProjectTreeItem[];

	abstract get treeItem(): vscode.TreeItem;

	public get friendlyName(): string {
		return path.parse(this.uri.path).base;
	}

	public get root() {
		let node: BaseProjectTreeItem = this;

		while (node.parent !== undefined) {
			node = node.parent;
		}

		return node;
	}
}

/**
 * Leaf tree item that just displays text for messaging purposes
 */
export class MessageTreeItem extends BaseProjectTreeItem {
	private message: string;

	constructor(message: string, parent?: BaseProjectTreeItem) {
		super(vscode.Uri.file(path.join(parent?.uri.path ?? 'Message', message)), parent);
		this.message = message;
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.message, vscode.TreeItemCollapsibleState.None);
	}
}

export const SpacerTreeItem = new MessageTreeItem('');

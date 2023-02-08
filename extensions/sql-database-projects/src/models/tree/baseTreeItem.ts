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
	/** Project-relative URI that's compatible with the project tree */
	relativeProjectUri: vscode.Uri;
	parent?: BaseProjectTreeItem;

	constructor(relativeProjectUri: vscode.Uri, parent?: BaseProjectTreeItem) {
		this.relativeProjectUri = relativeProjectUri;
		this.parent = parent;
	}

	abstract get children(): BaseProjectTreeItem[];

	abstract get treeItem(): vscode.TreeItem;

	public get friendlyName(): string {
		return path.parse(this.relativeProjectUri.path).base;
	}

	public get root() {
		let node: BaseProjectTreeItem = this;

		while (node.parent !== undefined) {
			node = node.parent;
		}

		return node;
	}
}

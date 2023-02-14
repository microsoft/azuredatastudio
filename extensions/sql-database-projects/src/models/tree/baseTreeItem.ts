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
	/**
	 * Constructor
	 * @param relativeProjectUri Project-relative URI that's compatible with the project tree
	 * @param sqlprojUri Full URI to the .sqlproj of this project
	 * @param parent parent tree item
	 */
	constructor(public relativeProjectUri: vscode.Uri, public sqlprojUri: vscode.Uri, public parent?: BaseProjectTreeItem) { }

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

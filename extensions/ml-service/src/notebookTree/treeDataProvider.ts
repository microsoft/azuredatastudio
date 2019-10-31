/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TreeNode } from '../notebookTree/treeModel';

export class TreeDataProvider implements azdata.TreeComponentDataProvider<TreeNode> {
	constructor(private _root: TreeNode, private _extensionContext: vscode.ExtensionContext) {
	}

	private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode>();

	/**
	 * Get [TreeItem](#TreeItem) representation of the `element`
	 *
	 * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
	 * @return [TreeItem](#TreeItem) representation of the element
	 */
	getTreeItem(element: TreeNode): azdata.TreeComponentItem | Thenable<azdata.TreeComponentItem> {
		let item: azdata.TreeComponentItem = {};
		item.label = element.label;
		item.collapsibleState = element.collapsibleState;
		item.iconPath = {
			light: this._extensionContext.asAbsolutePath(`resources/light/${element.type}.svg`),
			dark: this._extensionContext.asAbsolutePath(`resources/dark/${element.type}_inverse.svg`)
		};

		return item;
	}

	public get onDidChangeTreeData(): vscode.Event<TreeNode> {
		return this._onDidChangeTreeData.event;
	}

	public notifyRootChanged(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	/**
	 * Get the children of `element` or root if no element is passed.
	 *
	 * @param element The element from which the provider gets children. Can be `undefined`.
	 * @return Children of `element` or root if no element is passed.
	 */
	getChildren(element?: TreeNode): vscode.ProviderResult<TreeNode[]> {
		if (element) {
			return Promise.resolve(element.children);
		} else {
			return Promise.resolve(this._root.children);
		}
	}

	getParent(element?: TreeNode): vscode.ProviderResult<TreeNode> {
		if (element) {
			return Promise.resolve(element.parent);
		} else {
			return Promise.resolve(this._root);
		}
	}

}

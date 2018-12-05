/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { NodeInfo } from 'sqlops';

import { TreeNode } from './treeNode';
import { AzureResourceItemType } from './constants';

export class AzureResourceMessageTreeNode extends TreeNode {
	public constructor(
		public readonly message: string,
		parent: TreeNode
	) {
		super();

		this.parent = parent;
		this._id = `message_${AzureResourceMessageTreeNode._messageNum++}`;
	}

	public static create(message: string, parent: TreeNode): AzureResourceMessageTreeNode {
		return new AzureResourceMessageTreeNode(message, parent);
	}

	public getChildren(): TreeNode[] | Promise<TreeNode[]> {
		return [];
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(this.message, TreeItemCollapsibleState.None);
		item.contextValue = AzureResourceItemType.message;
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: this.message,
			isLeaf: true,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.message,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.message
		};
	}

	public get nodePathValue(): string {
		return this._id;
	}

	private _id: string;

	private static _messageNum: number = 0;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { NodeInfo } from 'azdata';

import { TreeNode } from './treeNode';
import { CmsResourceItemType } from './constants';

export class CmsResourceMessageTreeNode extends TreeNode {
	public constructor(
		public readonly message: string,
		parent: TreeNode
	) {
		super();

		this.parent = parent;
		this._id = `message_${CmsResourceMessageTreeNode._messageNum++}`;
	}

	public static create(message: string, parent: TreeNode): CmsResourceMessageTreeNode {
		return new CmsResourceMessageTreeNode(message, parent);
	}

	public getChildren(): TreeNode[] | Promise<TreeNode[]> {
		return [];
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(this.message, TreeItemCollapsibleState.None);
		item.contextValue = CmsResourceItemType.cmsMessageNodeContainer;
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
			nodeType: CmsResourceItemType.cmsMessageNodeContainer,
			nodeSubType: undefined,
			iconType: CmsResourceItemType.cmsMessageNodeContainer
		};
	}

	public get nodePathValue(): string {
		return this._id;
	}

	private _id: string;

	private static _messageNum: number = 0;
}

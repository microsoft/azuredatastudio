/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

type TreeNodePredicate = (node: TreeNode) => boolean;

export abstract class TreeNode {
	public generateNodePath(): string {
		let path = undefined;
		if (this.parent) {
			path = this.parent.generateNodePath();
		}
		path = path ? `${path}/${this.nodePathValue}` : this.nodePathValue;
		return path;
	}

	public findNodeByPath(path: string, expandIfNeeded: boolean = false): Promise<TreeNode> {
		let condition: TreeNodePredicate = (node: TreeNode) => node.getNodeInfo().nodePath === path;
		let filter: TreeNodePredicate = (node: TreeNode) => path.startsWith(node.getNodeInfo().nodePath);
		return TreeNode.findNode(this, condition, filter, true);
	}

	public static async findNode(node: TreeNode, condition: TreeNodePredicate, filter: TreeNodePredicate, expandIfNeeded: boolean): Promise<TreeNode> {
		if (!node) {
			return undefined;
		}

		if (condition(node)) {
			return node;
		}

		let nodeInfo = node.getNodeInfo();
		if (nodeInfo.isLeaf) {
			return undefined;
		}

		// TODO support filtering by already expanded / not yet expanded
		let children = await node.getChildren(false);
		if (children) {
			for (let child of children) {
				if (filter && filter(child)) {
					let childNode =  await this.findNode(child, condition, filter, expandIfNeeded);
					if (childNode) {
						return childNode;
					}
				}
			}
		}
		return undefined;
	}

	public get parent(): TreeNode {
		return this._parent;
	}

	public set parent(node: TreeNode) {
		this._parent = node;
	}

	public abstract getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]>;
	public abstract getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem>;

	public abstract getNodeInfo(): sqlops.NodeInfo;

	/**
	 * The value to use for this node in the node path
	 */
	public abstract get nodePathValue(): string;

	private _parent: TreeNode = undefined;
}

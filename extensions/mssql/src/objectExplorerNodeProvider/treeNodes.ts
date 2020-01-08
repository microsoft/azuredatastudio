/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ITreeNode } from './types';
import { IFileSource } from './fileSources';
import { SqlClusterConnection } from './connection';

type TreeNodePredicate = (node: TreeNode) => boolean;

export abstract class TreeNode implements ITreeNode {
	private _parent: TreeNode = undefined;
	protected fileSource: IFileSource;
	private _errorStatusCode: number;

	public get parent(): TreeNode {
		return this._parent;
	}

	public set parent(node: TreeNode) {
		this._parent = node;
	}

	public get errorStatusCode(): number {
		return this._errorStatusCode;
	}

	public set errorStatusCode(error: number) {
		this._errorStatusCode = error;
	}

	public generateNodePath(): string {
		let path = undefined;
		if (this.parent) {
			path = this.parent.generateNodePath();
		}
		path = path ? `${path}/${this.nodePathValue}` : this.nodePathValue;
		return path;
	}

	public findNodeByPath(path: string, expandIfNeeded: boolean = false): Promise<TreeNode> {
		let condition: TreeNodePredicate = (node: TreeNode) => node.getNodeInfo().nodePath === path || node.getNodeInfo().nodePath.startsWith(path);
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

		// TODO #3813 support filtering by already expanded / not yet expanded
		let children = await node.getChildren(false);
		if (children) {
			for (let child of children) {
				if (filter && filter(child)) {
					let childNode = await this.findNode(child, condition, filter, expandIfNeeded);
					if (childNode) {
						return childNode;
					}
				}
			}
		}
		return undefined;
	}

	public async updateFileSource(connection: SqlClusterConnection): Promise<void> {
		this.fileSource = await connection.createHdfsFileSource();
	}
	/**
	 * The value to use for this node in the node path
	 */
	public abstract get nodePathValue(): string;

	abstract getChildren(refreshChildren: boolean): TreeNode[] | Promise<TreeNode[]>;
	abstract getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem>;

	abstract getNodeInfo(): azdata.NodeInfo;
}

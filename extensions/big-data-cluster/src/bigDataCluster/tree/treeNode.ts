/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { generateGuid } from '../utils';

export abstract class TreeNode {

	private _id: string;
	private _children: TreeNode[];
	private _isLeaf: boolean;

	constructor(private _label: string, private _parent?: TreeNode) {
		this.resetId();
	}

	public resetId(): void {
		this._id = (this._label || '_') + `::${generateGuid()}`;
	}

	public get id(): string {
		return this._id;
	}

	public set label(label: string) {
		if (!this._label) {
			this._label = label;
			this.resetId();
		} else {
			this._label = label;
		}
	}

	public get label(): string {
		return this._label;
	}

	public set parent(parent: TreeNode) {
		this._parent = parent;
	}

	public get parent(): TreeNode {
		return this._parent;
	}

	public get children(): TreeNode[] {
		if (!this._children) {
			this._children = [];
		}
		return this._children;
	}

	public get hasChildren(): boolean {
		return this.children && this.children.length > 0;
	}

	public set isLeaf(isLeaf: boolean) {
		this._isLeaf = isLeaf;
	}

	public get isLeaf(): boolean {
		return this._isLeaf;
	}

	public get root(): TreeNode {
		return TreeNode.getRoot(this);
	}

	public equals(node: TreeNode): boolean {
		if (!node) {
			return undefined;
		}
		return this.nodePath === node.nodePath;
	}

	public refresh(): void {
		this.resetId();
	}

	public static getRoot(node: TreeNode): TreeNode {
		if (!node) {
			return undefined;
		}
		let current: TreeNode = node;
		while (current.parent) {
			current = current.parent;
		}
		return current;
	}

	public get nodePath(): string {
		return TreeNode.getNodePath(this);
	}

	public static getNodePath(node: TreeNode): string {
		if (!node) {
			return undefined;
		}

		let current: TreeNode = node;
		let path = current._id;
		while (current.parent) {
			current = current.parent;
			path = `${current._id}/${path}`;
		}
		return path;
	}

	public async findNode(condition: (node: TreeNode) => boolean, expandIfNeeded?: boolean): Promise<TreeNode> {
		return TreeNode.findNode(this, condition, expandIfNeeded);
	}

	public static async findNode(node: TreeNode, condition: (node: TreeNode) => boolean, expandIfNeeded?: boolean): Promise<TreeNode> {
		if (!node || !condition) {
			return undefined;
		}
		let result: TreeNode = undefined;
		let nodesToCheck: TreeNode[] = [node];
		while (nodesToCheck.length > 0) {
			let current = nodesToCheck.shift();
			if (condition(current)) {
				result = current;
				break;
			}
			if (current.hasChildren) {
				nodesToCheck = nodesToCheck.concat(current.children);
			} else if (expandIfNeeded) {
				let children = await current.getChildren();
				if (children && children.length > 0) {
					nodesToCheck = nodesToCheck.concat(children);
				}
			}
		}
		return result;
	}

	public async filterNode(condition: (node: TreeNode) => boolean, expandIfNeeded?: boolean): Promise<TreeNode[]> {
		return TreeNode.filterNode(this, condition, expandIfNeeded);
	}

	public static async filterNode(node: TreeNode, condition: (node: TreeNode) => boolean, expandIfNeeded?: boolean): Promise<TreeNode[]> {
		if (!node || !condition) {
			return undefined;
		}
		let result: TreeNode[] = [];
		let nodesToCheck: TreeNode[] = [node];
		while (nodesToCheck.length > 0) {
			let current = nodesToCheck.shift();
			if (condition(current)) {
				result.push(current);
			}
			if (current.hasChildren) {
				nodesToCheck = nodesToCheck.concat(current.children);
			} else if (expandIfNeeded) {
				let children = await current.getChildren();
				if (children && children.length > 0) {
					nodesToCheck = nodesToCheck.concat(children);
				}
			}
		}
		return result;
	}

	public async findNodeByPath(path: string, expandIfNeeded?: boolean): Promise<TreeNode> {
		return TreeNode.findNodeByPath(this, path, expandIfNeeded);
	}

	public static async findNodeByPath(node: TreeNode, path: string, expandIfNeeded?: boolean): Promise<TreeNode> {
		return TreeNode.findNode(node, node => {
			return node.nodePath && (node.nodePath === path || node.nodePath.startsWith(path));
		}, expandIfNeeded);
	}

	public addChild(node: TreeNode): void {
		if (!this._children) {
			this._children = [];
		}
		this._children.push(node);
	}

	public clearChildren(): void {
		if (this._children) {
			this._children = [];
		}
	}

	public abstract async getChildren(): Promise<TreeNode[]>;
	public abstract getTreeItem(): vscode.TreeItem;
	public abstract getNodeInfo(): azdata.NodeInfo;
}

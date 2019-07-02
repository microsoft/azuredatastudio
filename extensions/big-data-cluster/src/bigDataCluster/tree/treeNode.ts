/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export abstract class TreeNode {

	private _id: string;
	private _label: string;
	private _parent: TreeNode;
	private _children: TreeNode[];
	private _isLeaf: boolean;

	constructor(p?: {
		label: string;
		parent?: TreeNode;
	}) {
		this._label = p.label;
		this._parent = p.parent;
		this.resetId();
	}

	public resetId(): void {
		this._id = (this._label || '_') + `::${TreeNode.generateGuid()}`;
	}

	public get id(): string {
		return this._id;
	}

	public set label(label: string) {
		this._label = label;
		this.resetId();
	}

	public get label(): string {
		return this._label;
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

	private static generateGuid(): string {
		let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
		let oct: string = '';
		let tmp: number;
		for (let a: number = 0; a < 4; a++) {
			tmp = (4294967296 * Math.random()) | 0;
			oct += hexValues[tmp & 0xF] +
				hexValues[tmp >> 4 & 0xF] +
				hexValues[tmp >> 8 & 0xF] +
				hexValues[tmp >> 12 & 0xF] +
				hexValues[tmp >> 16 & 0xF] +
				hexValues[tmp >> 20 & 0xF] +
				hexValues[tmp >> 24 & 0xF] +
				hexValues[tmp >> 28 & 0xF];
		}
		let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
		return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
	}

	public abstract async getChildren(): Promise<TreeNode[]>;
	public abstract getTreeItem(): vscode.TreeItem;
	public abstract getNodeInfo(): azdata.NodeInfo;
}

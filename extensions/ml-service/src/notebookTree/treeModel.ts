/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
const fs = require('fs');
import * as path from 'path';

export class TreeNode implements azdata.TreeComponentItem {

	private _parent?: TreeNode;
	private _folderPath: string;
	private _type: string;
	private _name: string;
	private _children: TreeNode[];

	constructor(folderPath: string, name: string, parent: TreeNode) {
		this._folderPath = folderPath;
		this._parent = parent;
		if (name) {
			this._name = name.replace('.ipynb', '');
		}
	}

	public get collapsibleState(): vscode.TreeItemCollapsibleState {

		if (!this.isAlwaysLeaf) {
			return vscode.TreeItemCollapsibleState.Expanded;
		} else {
			return vscode.TreeItemCollapsibleState.None;
		}
	}

	public get label(): string {
		return this._name;
	}

	/**
	 * Is this a leaf node (in which case no children can be generated) or is it expandable?
	 */
	public get isAlwaysLeaf(): boolean {
		// tslint:disable-next-line:no-sync
		return fs.lstatSync(this._folderPath).isFile();
	}

	/**
	 * Parent of this node
	 */
	public get parent(): TreeNode {
		return this._parent;
	}

	public get data(): string {
		return this._folderPath;
	}

	public get type(): string {
		return this._type;
	}

	public set type(value: string) {
		this._type = value;
	}

	public get hasChildren(): boolean {
		return this.children !== undefined && this.children.length > 0;
	}

	/**
	 * Children of this node
	 */
	public get children(): TreeNode[] {
		if (this._children) {
			return this._children;
		} else {
			this._children = [];
		}

		// tslint:disable-next-line:no-sync
		let files = fs.readdirSync(this._folderPath);
		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			let node = new TreeNode(path.join(this._folderPath, file), file, this);
			if (file.endsWith('.ipynb')) {
				node.type = 'book';
			} else if (node.isAlwaysLeaf) {
				continue;
			} else {
				node.type = 'folder';
			}

			this._children.push(node);
		}

		return this._children;
	}
}

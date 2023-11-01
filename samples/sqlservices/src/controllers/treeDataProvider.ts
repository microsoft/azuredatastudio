/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';

export enum TreeCheckboxState {
	Intermediate = 0,
	Checked = 1,
	Unchecked = 2
}

export interface TreeComponentDataModel {
	label?: string;
	children?: TreeComponentDataModel[];
	id?: string;
	checked?: boolean;
}

export class TreeNode implements azdata.TreeComponentItem {
	private _onNodeChange = new vscode.EventEmitter<void>();
	private _onTreeChange = new vscode.EventEmitter<TreeNode>();
	private _data: TreeComponentDataModel;
	private _parent?: TreeNode;
	private _root: TreeNode;
	private _isAlwaysLeaf: boolean;
	private _nodeMap: Map<string, TreeNode>;
	private _children: TreeNode[];

	public readonly onNodeChange: vscode.Event<void> = this._onNodeChange.event;
	public readonly onTreeChange: vscode.Event<TreeNode> = this._onTreeChange.event;


	/**
	 * Creates new instance of tree node
	 * @param data the underlining data that's bind to the tree node, any change in the tree will affect the same node in data
	 * @param root the root node of the tree. If passed null, the current node will be the root
	 */
	constructor(data: TreeComponentDataModel, root: TreeNode) {
		if (!data) {
			throw new Error(`Invalid tree node data`);
		}
		if (root === undefined) {
			root = this;
			root._nodeMap = new Map<string, TreeNode>();
		}

		this._root = root;
		if (this.findNode(data.id)) {
			throw new Error(`tree node with id: '${data.id}' already exists`);
		}
		this._data = data;
	}

	/**
	 * id for TreeNode
	 */
	public get id(): string {
		return this.data.id;
	}

	public set id(value: string) {
		this.data.id = value;
	}

	/**
	 * Label to display to the user, describing this node
	 */
	public set label(value: string) {
		this.data.label = value;
	}

	public get collapsibleState(): vscode.TreeItemCollapsibleState {
		if (!this._isAlwaysLeaf) {
			return vscode.TreeItemCollapsibleState.Expanded;
		} else {
			vscode.TreeItemCollapsibleState.None;
		}
	}

	public get label(): string {
		return this.data.label;
	}

	/**
	 * Is this a leaf node (in which case no children can be generated) or is it expandable?
	 */
	public get isAlwaysLeaf(): boolean {
		return this._isAlwaysLeaf;
	}

	/**
	 * Parent of this node
	 */
	public get parent(): TreeNode {
		return this._parent;
	}

	public get root(): TreeNode {
		return this._root;
	}

	/**
	 * Path identifying this node
	 */
	public get nodePath(): string {
		return `${this.parent ? this.parent.nodePath + '-' : ''}${this.id}`;
	}

	public get data(): TreeComponentDataModel {
		if (this._data === undefined) {
			this._data = {
				label: undefined
			};
		}
		return this._data;
	}

	/**
	 * Sets node checked state to the given value.
	 * @param value New checked state for the node.
	 * @param fromParent Flag that indicates whether change is being propagated from child to parent (false),
	 * 	from parent to child (true), or state change was initiated by the user (undefined).
	 * @returns true if state has changed, otherwise false.
	 */
	public changeNodeCheckedState(value: boolean, fromParent?: boolean): boolean {
		if (value === this.checked) {
			return false;
		}

		if (fromParent !== false && this.children) {
			// State change is caused by the user or propagation from parent - propagate new state to children
			this.children.forEach(child => {
				child.changeNodeCheckedState(value, true);
			});
		}

		this.checked = value;
		this._onNodeChange.fire();

		if (fromParent !== true) {
			// State change is caused by the user or propagation from children - notify parent about check state change
			// Raise change event from here, if it's not coming from parent and parent node didn't change,
			// otherwise parent node will raise this event
			if (!this.parent?.refreshState(value) && this.root) {
				this.root._onTreeChange.fire(this);
			}
		}

		return true;
	}

	public set checked(value: boolean) {
		this.data.checked = value;
	}

	/**
	 * Refreshes the state of the node based on the state of the children nodes.
	 * @param childState New check state of the child node that caused the refresh.
	 * @returns true if state has changed, otherwise false.
	 */
	public refreshState(childState?: boolean): boolean {
		if (childState === undefined) {
			// Child node is changing to partially checked.
			// In this case we simply follow its state, as we know not all children are selected further down the tree.
			return this.changeNodeCheckedState(undefined, false);
		} else {
			// Child node is changing to fully checked or unchecked.
			// In this case we can either change to that same state if all children are the same or become partially checked.
			return this.changeNodeCheckedState(
				!this.children || this.children.every(c => c.checked === childState)
					? childState
					: undefined,
				false);
		}
	}

	public get checked(): boolean {
		return this.data.checked;
	}

	public get checkboxState(): TreeCheckboxState {
		if (this.checked === undefined) {
			return TreeCheckboxState.Intermediate;
		} else {
			return this.checked ? TreeCheckboxState.Checked : TreeCheckboxState.Unchecked;
		}
	}

	public findNode(id: string): TreeNode {
		if (this.id === id) {
			return this;
		} else if (this.root) {
			return this.root._nodeMap.has(id) ? this.root._nodeMap.get(id) : undefined;
		} else {
			let node: TreeNode;
			if (this.children) {
				this.children.forEach(child => {
					node = child.findNode(id);
					if (node) {
						return;
					}
				});
			}

			return node;
		}
	}

	/**
	 * Children of this node
	 */
	public get children(): TreeNode[] {
		return this._children;
	}

	public addChildNode(node: TreeNode): void {

		if (node) {
			if (!node.root) {
				node._root = this.root;
			}
			if (!node.parent) {
				node._parent = this;
			}
			if (node.root) {
				node.root._nodeMap.set(node.id, node);
			}
			this._children.push(node);
		}
	}

	public static createNode(nodeData: TreeComponentDataModel, parent?: TreeNode, root?: TreeNode): TreeNode {
		let rootNode = root || (parent !== undefined ? parent.root : undefined);
		let treeNode = new TreeNode(nodeData, rootNode);

		treeNode._parent = parent;
		return treeNode;
	}

	public static createTree(nodeData: TreeComponentDataModel, parent?: TreeNode, root?: TreeNode): TreeNode {
		if (nodeData) {
			let treeNode = TreeNode.createNode(nodeData, parent, root);

			if (nodeData.children && nodeData.children.length > 0) {
				treeNode._isAlwaysLeaf = false;
				treeNode._children = [];
				nodeData.children.forEach(childNode => {
					if (childNode) {
						let childTreeNode = TreeNode.createTree(childNode, treeNode, root || treeNode.root);
						treeNode.addChildNode(childTreeNode);
					}
				});
				treeNode.refreshState();
			} else {
				treeNode._isAlwaysLeaf = true;
			}
			return treeNode;
		} else {
			return undefined;
		}
	}
}

export class TreeDataProvider implements azdata.TreeComponentDataProvider<TreeNode> {
	private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode>();

	constructor(private _root: TreeNode) {
		if (this._root) {
			this._root.onTreeChange(node => {
				this._onDidChangeTreeData.fire(node);
			});
		}
	}

	onDidChangeTreeData?: vscode.Event<TreeNode | undefined | null> = this._onDidChangeTreeData.event ;

	/**
	 * Get [TreeItem](#TreeItem) representation of the `element`
	 *
	 * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
	 * @return [TreeItem](#TreeItem) representation of the element
	 */
	getTreeItem(element: TreeNode): azdata.TreeComponentItem | Thenable<azdata.TreeComponentItem> {
		let item: azdata.TreeComponentItem = {};
		item.label = element.label;
		item.checked = element.checked;
		item.collapsibleState = element.collapsibleState;
		item.iconPath = vscode.Uri.file(path.join(__dirname, '..', 'media', 'monitor.svg'));
		return item;
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
			return Promise.resolve([this._root]);
		}
	}

	/**
	 * Gets the parent of `element`. Returns `null` or `undefined` if `element` is a child of root.
	 *
	 * @param element The element from which the provider gets parent.
	 * @returns Parent of the `element` or undefined.
	 */
	getParent(element: TreeNode): vscode.ProviderResult<TreeNode> {
		return Promise.resolve(element.parent);
	}
}

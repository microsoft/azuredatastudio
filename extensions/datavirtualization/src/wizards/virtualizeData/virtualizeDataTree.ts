/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { Uri, ThemeIcon, TreeItemCheckboxState } from 'vscode';

export enum TreeCheckboxState {
	Intermediate = 0,
	Checked = 1,
	Unchecked = 2
}

export interface CheckboxTreeNodeArg {
	treeId?: string;
	nodeId?: string;
	isRoot?: boolean;
	label?: string;
	maxLabelLength?: number;
	isLeaf?: boolean;
	isChecked?: boolean;
	isEnabled?: boolean;
}

export abstract class CheckboxTreeNode implements azdata.TreeComponentItem {

	protected _onNodeChange = new vscode.EventEmitter<void>();
	protected _onTreeChange = new vscode.EventEmitter<CheckboxTreeNode>();
	public readonly onNodeChange: vscode.Event<void> = this._onNodeChange.event;
	public readonly onTreeChange: vscode.Event<CheckboxTreeNode> = this._onTreeChange.event;

	private _nodeId: string;
	public label: string;
	private _isRoot: boolean;
	private _isLeaf: boolean;
	private _isChecked: boolean;
	private _isEnabled: boolean;
	private _treeId: string;
	private _maxLabelLength: number;

	private _rootNode: CheckboxTreeNode;
	private _parent?: CheckboxTreeNode;
	private _children: CheckboxTreeNode[];

	private static _nodeRegistry: { [treeId: string]: Map<string, CheckboxTreeNode> } = {};

	constructor(treeArg?: CheckboxTreeNodeArg) {
		this._isRoot = false;
		this._isLeaf = false;
		this._isChecked = false;
		this._isEnabled = true;
		this.setArgs(treeArg);
	}

	public setArgs(treeArg: CheckboxTreeNodeArg): void {
		if (treeArg) {
			this._isRoot = treeArg.isRoot !== undefined ? treeArg.isRoot : this._isRoot;
			this._treeId = treeArg.treeId || this._treeId;
			this._nodeId = this._isRoot ? 'root' : (treeArg.nodeId || this._nodeId);
			this.label = this._isRoot ? 'root' : (treeArg.label || this.label);
			this._isLeaf = treeArg.isLeaf !== undefined ? treeArg.isLeaf : this._isLeaf;
			this._isChecked = treeArg.isChecked !== undefined ? treeArg.isChecked : this._isChecked;
			this._isEnabled = treeArg.isEnabled !== undefined ? treeArg.isEnabled : this._isEnabled;
			this._maxLabelLength = treeArg.maxLabelLength || this._maxLabelLength;
		}
		CheckboxTreeNode.AddToNodeRegistry(this);
	}

	public static clearNodeRegistry(): void {
		CheckboxTreeNode._nodeRegistry = {};
	}

	private static AddToNodeRegistry(node: CheckboxTreeNode): void {
		if (node._treeId && node._nodeId) {
			if (!CheckboxTreeNode._nodeRegistry[node._treeId]) {
				CheckboxTreeNode._nodeRegistry[node._treeId] = new Map<string, CheckboxTreeNode>();
			}
			let registry = CheckboxTreeNode._nodeRegistry[node._treeId];
			if (!registry.has(node._nodeId)) {
				registry.set(node._nodeId, node);
			} else {
				throw new Error(`tree node with id: '${node._nodeId}' already exists`);
			}
		}
	}

	public static findNode(treeId: string, nodeId: string): CheckboxTreeNode {
		let wantedNode: CheckboxTreeNode = undefined;
		if (treeId && nodeId && CheckboxTreeNode._nodeRegistry[treeId] && CheckboxTreeNode._nodeRegistry[treeId].has(nodeId)) {
			wantedNode = CheckboxTreeNode._nodeRegistry[treeId].get(nodeId);
		}
		return wantedNode;
	}

	public get id(): string {
		return this._nodeId;
	}

	public get parent(): CheckboxTreeNode {
		return this._parent;
	}

	public get children(): CheckboxTreeNode[] {
		return this._children;
	}

	public set children(children: CheckboxTreeNode[]) {
		if (children) {
			this._children = children;
		}
	}

	public get isRoot(): boolean {
		return this._isRoot;
	}

	public get isLeaf(): boolean {
		return this._isLeaf;
	}

	public set isLeaf(isLeaf: boolean) {
		if (isLeaf !== undefined) {
			this._isLeaf = isLeaf;
		}
	}

	public get treeId(): string {
		return this._treeId;
	}

	public set treeId(treeId: string) {
		if (treeId) {
			this._treeId = treeId;
		}
	}

	public get checked(): boolean {
		return this._isChecked;
	}

	public get enabled(): boolean {
		return this._isEnabled;
	}

	public get hasChildren(): boolean {
		return this._children !== undefined && this._children.length > 0;
	}

	protected get rootNode(): CheckboxTreeNode {
		if (!this._rootNode && this._treeId) {
			this._rootNode = CheckboxTreeNode._nodeRegistry[this._treeId].get('root');
		}
		return this._rootNode;
	}

	public get collapsibleState(): vscode.TreeItemCollapsibleState {
		if (!this._isLeaf) {
			return vscode.TreeItemCollapsibleState.Expanded;
		} else {
			vscode.TreeItemCollapsibleState.None;
		}
	}

	public abstract get iconPath(): string | Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon;

	public get nodePath(): string {
		return `${this.parent ? this.parent.nodePath + '-' : ''}${this.id}`;
	}

	public async setCheckedState(isChecked: boolean): Promise<void> {
		let nodesToCheck: CheckboxTreeNode[] = [this];
		while (nodesToCheck && nodesToCheck.length > 0) {
			let node = nodesToCheck.shift();
			if (node._isEnabled) {
				node._isChecked = isChecked;
				node.notifyStateChanged();
				if (node.hasChildren) {
					nodesToCheck = node._children.concat(nodesToCheck);
				}
				if (node.parent) {
					await node.parent.refreshCheckedState();
				}
			}
		}
		this.notifyStateChanged();
	}

	public async refreshCheckedState(): Promise<void> {
		let nodeToRefresh: CheckboxTreeNode = this;
		while (nodeToRefresh && nodeToRefresh.hasChildren) {
			if (nodeToRefresh._children.every(c => c.checked)) {
				if (!nodeToRefresh._isChecked) {
					nodeToRefresh._isChecked = true;
					nodeToRefresh.notifyStateChanged();
					nodeToRefresh = nodeToRefresh.parent;
				} else {
					nodeToRefresh = undefined;
				}
			} else if (nodeToRefresh._children.every(c => c.checked === false)) {
				if (nodeToRefresh._isChecked !== false) {
					nodeToRefresh._isChecked = false;
					nodeToRefresh.notifyStateChanged();
					nodeToRefresh = nodeToRefresh.parent;
				} else {
					nodeToRefresh = undefined;
				}
			} else {
				if (nodeToRefresh._isChecked !== undefined) {
					nodeToRefresh._isChecked = undefined;
					nodeToRefresh.notifyStateChanged();
					nodeToRefresh = nodeToRefresh.parent;
				} else {
					nodeToRefresh = undefined;
				}
			}
		}
		this.notifyStateChanged();
	}

	public async setEnable(isEnabled: boolean): Promise<void> {
		if (isEnabled === undefined) {
			isEnabled = true;
		}

		let nodesToSet: CheckboxTreeNode[] = [this];
		while (nodesToSet && nodesToSet.length > 0) {
			let node = nodesToSet.shift();
			node._isEnabled = isEnabled;
			node.notifyStateChanged();
			if (node.hasChildren) {
				nodesToSet = node._children.concat(nodesToSet);
			}
			if (node.parent) {
				await node.parent.refreshEnableState();
			}
		}
		this.notifyStateChanged();
	}

	public async refreshEnableState(): Promise<void> {
		let nodeToRefresh: CheckboxTreeNode = this;
		while (nodeToRefresh && nodeToRefresh.hasChildren) {
			if (nodeToRefresh._children.every(c => c._isEnabled === false)) {
				if (nodeToRefresh._isEnabled !== false) {
					nodeToRefresh._isEnabled = false;
					nodeToRefresh.notifyStateChanged();
					nodeToRefresh = nodeToRefresh.parent;
				} else {
					nodeToRefresh = undefined;
				}
			} else {
				if (!nodeToRefresh._isEnabled) {
					nodeToRefresh._isEnabled = true;
					nodeToRefresh.notifyStateChanged();
					nodeToRefresh = nodeToRefresh.parent;
				} else {
					nodeToRefresh = undefined;
				}
			}
		}
		this.notifyStateChanged();
	}

	public notifyStateChanged(): void {
		this._onNodeChange.fire();
		let rootNode = this.rootNode;
		if (rootNode) {
			rootNode._onTreeChange.fire(this);
		}
	}

	public get checkboxState(): TreeItemCheckboxState {
		if (this.checked === undefined) {
			return TreeItemCheckboxState.Unchecked;
		} else {
			return this.checked ? TreeItemCheckboxState.Checked : TreeItemCheckboxState.Unchecked;
		}
	}

	public findNode(nodeId: string): CheckboxTreeNode {
		let wantedNode: CheckboxTreeNode = undefined;
		if (this.id === nodeId) {
			wantedNode = this;
		} else {
			wantedNode = CheckboxTreeNode.findNode(this._treeId, nodeId);
		}
		return wantedNode;
	}

	public abstract getChildren(): Promise<CheckboxTreeNode[]>;

	public clearChildren(): void {
		if (this.children) {
			this.children.forEach(child => {
				child.clearChildren();
			});
			this._children = undefined;
			this.notifyStateChanged();
		}
	}

	public addChildNode(node: CheckboxTreeNode): void {
		if (node) {
			if (!this._children) {
				this._children = [];
			}
			node._parent = this;
			this._children.push(node);
		}
	}
}

export class CheckboxTreeDataProvider implements azdata.TreeComponentDataProvider<CheckboxTreeNode> {
	private _onDidChangeTreeData = new vscode.EventEmitter<CheckboxTreeNode>();
	constructor(private _root: CheckboxTreeNode) {
		if (this._root) {
			this._root.onTreeChange(node => {
				this._onDidChangeTreeData.fire(node);
			});
		}
	}

	onDidChangeTreeData?: vscode.Event<CheckboxTreeNode | undefined | null> = this._onDidChangeTreeData.event;

	/**
	 * Get [TreeItem](#TreeItem) representation of the `element`
	 *
	 * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
	 * @return [TreeItem](#TreeItem) representation of the element
	 */
	getTreeItem(element: CheckboxTreeNode): azdata.TreeComponentItem | Thenable<azdata.TreeComponentItem> {
		let item: azdata.TreeComponentItem = {};
		item.label = element.label;
		item.checked = element.checked;
		item.collapsibleState = element.isLeaf ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed;
		item.iconPath = element.iconPath;
		item.enabled = element.enabled;
		return item;
	}

	/**
	 * Get the children of `element` or root if no element is passed.
	 *
	 * @param element The element from which the provider gets children. Can be `undefined`.
	 * @return Children of `element` or root if no element is passed.
	 */
	getChildren(element?: CheckboxTreeNode): vscode.ProviderResult<CheckboxTreeNode[]> {
		if (element) {
			return element.getChildren();
		} else {
			return Promise.resolve(this._root.getChildren());
		}
	}

	getParent(element?: CheckboxTreeNode): vscode.ProviderResult<CheckboxTreeNode> {
		if (element) {
			return Promise.resolve(element.parent);
		} else {
			return Promise.resolve(this._root);
		}
	}
}

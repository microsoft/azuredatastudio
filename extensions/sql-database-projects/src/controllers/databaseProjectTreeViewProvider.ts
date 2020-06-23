/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { BaseProjectTreeItem, SpacerTreeItem } from '../models/tree/baseTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { Project } from '../models/project';

/**
 * Tree view for database projects
 */
export class SqlDatabaseProjectTreeViewProvider implements vscode.TreeDataProvider<BaseProjectTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<BaseProjectTreeItem | undefined> = new vscode.EventEmitter<BaseProjectTreeItem | undefined>();
	private treeView: vscode.TreeView<BaseProjectTreeItem> | undefined;
	readonly onDidChangeTreeData: vscode.Event<BaseProjectTreeItem | undefined> = this._onDidChangeTreeData.event;

	private roots: BaseProjectTreeItem[] = [];

	constructor() {
		this.initialize();
	}

	private initialize() {
		this.roots = [];
	}

	public getTreeItem(element: BaseProjectTreeItem): vscode.TreeItem {
		return element.treeItem;
	}

	public getChildren(element?: BaseProjectTreeItem): BaseProjectTreeItem[] {
		if (element === undefined) {
			return this.roots;
		}

		return element.children;
	}

	/**
	 * Constructs a new set of root nodes from a list of Projects
	 * @param projects List of Projects
	 */
	public load(projects: Project[]) {
		let newRoots: BaseProjectTreeItem[] = [];

		for (const proj of projects) {
			newRoots.push(new ProjectRootTreeItem(proj));
			newRoots.push(SpacerTreeItem);
		}

		if (newRoots[newRoots.length - 1] === SpacerTreeItem) {
			newRoots.pop(); // get rid of the trailing SpacerTreeItem
		}

		this.roots = newRoots;
		this._onDidChangeTreeData.fire(undefined);
	}

	public setTreeView(value: vscode.TreeView<BaseProjectTreeItem>) {
		if (this.treeView) {
			throw new Error('TreeView should not be set multiple times.');
		}

		this.treeView = value;
	}

	public async focus(project: Project): Promise<void> {
		const projNode = this.roots.find(x => x instanceof ProjectRootTreeItem ? (<ProjectRootTreeItem>x).project === project : false);

		if (projNode) {
			this.treeView?.reveal(projNode, { focus: true, expand: true });
		}
	}
}

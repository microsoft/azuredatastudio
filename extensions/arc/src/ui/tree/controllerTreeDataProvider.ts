/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ControllerTreeNode } from './controllerTreeNode';
import { TreeNode } from './treeNode';
import { LoadingControllerNode as LoadingTreeNode } from './loadingTreeNode';
import { ControllerModel } from '../../models/controllerModel';

/**
 * The TreeDataProvider for the Azure Arc view, which displays a list of registered
 * controllers and the resources under them.
 */
export class AzureArcTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined> = new vscode.EventEmitter<TreeNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined> = this._onDidChangeTreeData.event;

	private _loading: boolean = true;
	private _loadingNode = new LoadingTreeNode();

	private _controllerNodes: ControllerTreeNode[] = [];

	constructor(private _context: vscode.ExtensionContext) {
		// TODO: 
		setTimeout(() => {
			this._loading = false;
			this._onDidChangeTreeData.fire(undefined);
		}, 5000);
	}

	public async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (this._loading) {
			return [this._loadingNode];
		}

		if (element) {
			return element.getChildren();
		} else {
			return this._controllerNodes;
		}
	}

	public getTreeItem(element: TreeNode): TreeNode | Thenable<TreeNode> {
		return element;
	}

	public addController(model: ControllerModel): void {
		this._controllerNodes.push(new ControllerTreeNode(model, this._context));
		this._onDidChangeTreeData.fire(undefined);
	}

	public removeController(controllerNode: ControllerTreeNode): void {
		this._controllerNodes = this._controllerNodes.filter(node => node !== controllerNode);
		this._onDidChangeTreeData.fire(undefined);
	}
}

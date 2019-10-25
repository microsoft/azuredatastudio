/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { TreeModel } from './treeModel';
import * as mssql from '../../../mssql/src/mssql';

const localize = nls.loadMessageBundle();

export class TreeViewProvider implements vscode.TreeDataProvider<mssql.ITreeNode> {

	private _onDidChangeTreeData = new vscode.EventEmitter<mssql.ITreeNode>();

	// For testing
	private _errorMessage: string;
	public viewId: string;
	public projectRoot: TreeModel;

	constructor(view: string) {
		this.viewId = view;
	}

	public get onDidChangeTreeData(): vscode.Event<mssql.ITreeNode> {
		return this._onDidChangeTreeData.event;
	}

	public Initialize(model: TreeModel): void {
			this.projectRoot = model;
			this.notifyRootChanged();
	}

	getTreeItem(element?: mssql.ITreeNode): any | Promise<any> {
		if (element) {
			let nodeInfo =  element.getNodeInfo();
			return nodeInfo ? nodeInfo : element;
		}
		return element;
	}

	getChildren(element?: mssql.ITreeNode): Thenable<mssql.ITreeNode[]> {

		return Promise.resolve(this.projectRoot.Nodes);
	}

	getParent(element?: mssql.ITreeNode): vscode.ProviderResult<mssql.ITreeNode> {
		return undefined;
	}

	public get errorMessage() {
		return this._errorMessage;
	}

	public notifyRootChanged(): void {
		this._onDidChangeTreeData.fire(undefined);
	}
}

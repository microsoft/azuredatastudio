/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TreeNode } from './treeNode';
import { BdcItemType } from '../constants';

const localize = nls.loadMessageBundle();

export class AddControllerNode extends TreeNode {
	private readonly nodeType: string;

	constructor() {
		super(localize('textBigDataClusterControllerWithDots', "Add SQL Server Big Data Cluster controller..."));
		this.nodeType = BdcItemType.addController;
	}

	public async getChildren(): Promise<TreeNode[]> {
		return [];
	}

	public getTreeItem(): vscode.TreeItem {
		let item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.None);
		item.command = {
			title: localize('textConnectToController', "Connect to Controller"),
			command: 'bigDataClusters.command.addController',
			arguments: [this]
		};
		item.contextValue = this.nodeType;
		return item;
	}

	public getNodeInfo(): azdata.NodeInfo {
		return {
			label: this.label,
			isLeaf: this.isLeaf,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.nodePath,
			nodeStatus: undefined,
			nodeType: this.nodeType,
			iconType: this.nodeType,
			nodeSubType: undefined
		};
	}
}

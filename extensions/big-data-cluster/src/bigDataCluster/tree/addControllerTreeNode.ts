/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vscode-nls';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { NodeInfo } from 'azdata';
import { TreeNode } from './treeNode';
import { BdcItemType } from '../constants';

const localize = nls.loadMessageBundle();

export class AddControllerNode extends TreeNode {
	private readonly nodeType: string;

	constructor() {
		super({ label: localize('bigDataClusters.addControllerNodeLabel', 'Add Big Data Cluster Controller...') });
		this.nodeType = BdcItemType.addController;
	}

	public async getChildren(): Promise<TreeNode[]> {
		return [];
	}

	public getTreeItem(): TreeItem {
		let item = new TreeItem(this.label, TreeItemCollapsibleState.None);
		item.command = {
			title: 'Add SQL Server Big Data Cluster Controller',
			command: 'bigDataClusters.command.addController',
			arguments: [this]
		};
		item.contextValue = this.nodeType;
		return item;
	}

	public getNodeInfo(): NodeInfo {
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

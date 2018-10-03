/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { NodeInfo } from 'sqlops';
import { TreeNode } from '../../treeNodes';

import { AzureResourceTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType } from '../constants';
import { AzureResourceDatabaseServer } from '../models';
import { IAzureResourceTreeChangeHandler } from './treeProvider';

export class AzureResourceDatabaseServerTreeNode extends AzureResourceTreeNodeBase {
	public constructor(
		public readonly databaseServer: AzureResourceDatabaseServer,
		treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(treeChangeHandler, parent);
	}

	public async getChildren(): Promise<TreeNode[]> {
		return [];
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(this.databaseServer.name, TreeItemCollapsibleState.None);
		item.contextValue = AzureResourceItemType.databaseServer;
		item.iconPath = {
			dark: this.servicePool.contextService.getAbsolutePath('resources/dark/sql_server_inverse.svg'),
			light: this.servicePool.contextService.getAbsolutePath('resources/light/sql_server.svg')
		};
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: this.databaseServer.name,
			isLeaf: true,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.databaseServer,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.databaseServer
		};
	}

	public get nodePathValue(): string {
		return `databaseServer_${this.databaseServer.name}`;
	}
}

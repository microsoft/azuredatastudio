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
import { AzureResourceDatabase } from '../models';
import { IAzureResourceTreeChangeHandler } from './treeProvider';

export class AzureResourceDatabaseTreeNode extends AzureResourceTreeNodeBase {
	public constructor(
		public readonly database: AzureResourceDatabase,
		treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(treeChangeHandler, parent);

		this._label = `${this.database.name} (${this.database.serverName})`;
	}

	public async getChildren(): Promise<TreeNode[]> {
		return [];
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(this._label, TreeItemCollapsibleState.None);
		item.contextValue = AzureResourceItemType.database;
		item.iconPath = {
			dark: this.servicePool.contextService.getAbsolutePath('resources/dark/sql_database_inverse.svg'),
			light: this.servicePool.contextService.getAbsolutePath('resources/light/sql_database.svg')
		};
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: this._label,
			isLeaf: true,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.database,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.database
		};
	}

	public get nodePathValue(): string {
		return `database_${this.database.name}`;
	}

	private _label: string = undefined;
}

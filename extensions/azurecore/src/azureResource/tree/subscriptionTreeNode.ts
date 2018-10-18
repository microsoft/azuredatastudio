/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Account, NodeInfo } from 'sqlops';
import { TreeNode } from '../../treeNodes';

import { AzureResourceTreeNodeBase, AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType } from '../constants';
import { AzureResourceDatabaseContainerTreeNode } from './databaseContainerTreeNode';
import { AzureResourceDatabaseServerContainerTreeNode } from './databaseServerContainerTreeNode';
import { AzureResourceSubscription } from '../models';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';

export class AzureResourceSubscriptionTreeNode extends AzureResourceTreeNodeBase {
	public constructor(
		public readonly subscription: AzureResourceSubscription,
		account: Account,
		treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(treeChangeHandler, parent);

		this._children.push(new AzureResourceDatabaseContainerTreeNode(subscription, account, treeChangeHandler, this));
		this._children.push(new AzureResourceDatabaseServerContainerTreeNode(subscription, account, treeChangeHandler, this));
	}

	public async getChildren(): Promise<TreeNode[]> {
		return this._children;
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(this.subscription.name, TreeItemCollapsibleState.Collapsed);
		item.contextValue = AzureResourceItemType.subscription;
		item.iconPath = {
			dark: this.servicePool.contextService.getAbsolutePath('resources/dark/subscription_inverse.svg'),
			light: this.servicePool.contextService.getAbsolutePath('resources/light/subscription.svg')
		};
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: this.subscription.name,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.subscription,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.subscription
		};
	}

	public get nodePathValue(): string {
		return `subscription_${this.subscription.id}`;
	}

	private _children: AzureResourceContainerTreeNodeBase[] = [];
}

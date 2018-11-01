/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Account, NodeInfo } from 'sqlops';
import { TreeNode } from '../../treeNodes';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType } from '../constants';
import { AzureResourceErrorMessageUtil } from '../utils';
import { AzureResourceDatabaseTreeNode } from './databaseTreeNode';
import { AzureResourceMessageTreeNode } from './messageTreeNode';
import { AzureResourceSubscription, AzureResourceDatabase } from '../models';
import { IAzureResourceTreeChangeHandler } from './treeProvider';

export class AzureResourceDatabaseContainerTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly subscription: AzureResourceSubscription,
		account: Account,
		treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(account, treeChangeHandler, parent);
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let databases: AzureResourceDatabase[] = [];

			if (this._isClearingCache) {
				let credentials = await this.getCredentials();
				databases = (await this.servicePool.databaseService.getDatabases(this.subscription, credentials)) || <AzureResourceDatabase[]>[];

				let cache = this.getCache<AzureResourceDatabasesCache>();
				if (!cache) {
					cache = { databases: { } };
				}
				cache.databases[this.subscription.id] = databases;
				this.updateCache(cache);

				this._isClearingCache = false;
			} else {
				const cache = this.getCache<AzureResourceDatabasesCache>();
				if (cache) {
					databases = cache.databases[this.subscription.id] || <AzureResourceDatabase[]>[];
				}
			}

			if (databases.length === 0) {
				return [AzureResourceMessageTreeNode.create(AzureResourceDatabaseContainerTreeNode.NoDatabases, this)];
			} else {
				return databases.map((database) => new AzureResourceDatabaseTreeNode(database, this.treeChangeHandler, this));
			}
		} catch (error) {
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(AzureResourceDatabaseContainerTreeNode.Label, TreeItemCollapsibleState.Collapsed);
		item.contextValue = AzureResourceItemType.databaseContainer;
		item.iconPath = {
			dark: this.servicePool.contextService.getAbsolutePath('resources/dark/folder_inverse.svg'),
			light: this.servicePool.contextService.getAbsolutePath('resources/light/folder.svg')
		};
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: AzureResourceDatabaseContainerTreeNode.Label,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.databaseContainer,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.databaseContainer
		};
	}

	public get nodePathValue(): string {
		return 'databaseContainer';
	}

	protected get cacheKey(): string {
		return 'azureResource.cache.databases';
	}

	private static readonly Label = localize('azureResource.tree.databaseContainerTreeNode.label', 'SQL Databases');
	private static readonly NoDatabases = localize('azureResource.tree.databaseContainerTreeNode.noDatabases', 'No SQL Databases found.');
}

interface AzureResourceDatabasesCache {
	databases: { [subscriptionId: string]: AzureResourceDatabase[] };
}

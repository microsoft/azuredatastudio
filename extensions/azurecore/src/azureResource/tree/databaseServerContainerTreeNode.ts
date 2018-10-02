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
import { AzureResourceMessageTreeNode } from './messageTreeNode';
import { AzureResourceErrorMessageUtil } from '../utils';
import { AzureResourceSubscription, AzureResourceDatabaseServer } from '../models';
import { AzureResourceDatabaseServerTreeNode } from './databaseServerTreeNode';
import { IAzureResourceTreeChangeHandler } from './treeProvider';

export class AzureResourceDatabaseServerContainerTreeNode extends AzureResourceContainerTreeNodeBase {
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
			let databaseServers: AzureResourceDatabaseServer[] = [];

			if (this._isClearingCache) {
				let credentials = await this.getCredentials();
				databaseServers = (await this.servicePool.databaseServerService.getDatabaseServers(this.subscription, credentials)) || <AzureResourceDatabaseServer[]>[];

				let cache = this.getCache<AzureResourceDatabaseServersCache>();
				if (!cache) {
					cache = { databaseServers: { } };
				}
				cache.databaseServers[this.subscription.id] = databaseServers;
				this.updateCache<AzureResourceDatabaseServersCache>(cache);

				this._isClearingCache = false;
			} else {
				const cache = this.getCache<AzureResourceDatabaseServersCache>();
				if (cache) {
					databaseServers = cache.databaseServers[this.subscription.id] || <AzureResourceDatabaseServer[]>[];
				}
			}

			if (databaseServers.length === 0) {
				return [AzureResourceMessageTreeNode.create(AzureResourceDatabaseServerContainerTreeNode.NoDatabaseServers, this)];
			} else {
				return databaseServers.map((server) => new AzureResourceDatabaseServerTreeNode(server, this.treeChangeHandler, this));
			}
		} catch (error) {
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(AzureResourceDatabaseServerContainerTreeNode.Label, TreeItemCollapsibleState.Collapsed);
		item.contextValue = AzureResourceItemType.databaseServerContainer;
		item.iconPath = {
			dark: this.servicePool.contextService.getAbsolutePath('resources/dark/folder_inverse.svg'),
			light: this.servicePool.contextService.getAbsolutePath('resources/light/folder.svg')
		};
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: AzureResourceDatabaseServerContainerTreeNode.Label,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.databaseServerContainer,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.databaseServerContainer
		};
	}

	public get nodePathValue(): string {
		return 'databaseServerContainer';
	}

	protected get cacheKey(): string {
		return 'azureResource.cache.databaseServers';
	}

	private static readonly Label = localize('azureResource.tree.databaseServerContainerTreeNode.label', 'SQL Servers');
	private static readonly NoDatabaseServers = localize('azureResource.tree.databaseContainerTreeNode.noDatabaseServers', 'No SQL Servers found.');
}

interface AzureResourceDatabaseServersCache {
	databaseServers: { [subscriptionId: string]: AzureResourceDatabaseServer[] };
}

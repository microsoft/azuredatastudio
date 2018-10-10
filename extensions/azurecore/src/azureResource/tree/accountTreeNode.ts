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
import { AzureResourceSubscriptionTreeNode } from './subscriptionTreeNode';
import { AzureResourceMessageTreeNode } from './messageTreeNode';
import { AzureResourceErrorMessageUtil } from '../utils';
import { AzureResourceSubscription } from '../models';
import { IAzureResourceTreeChangeHandler } from './treeProvider';

export class AzureResourceAccountTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		account: Account,
		treeChangeHandler: IAzureResourceTreeChangeHandler
	) {
		super(account, treeChangeHandler, undefined);

		this._id = `account_${this.account.key.accountId}`;
		this._label = this.generateLabel();
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let subscriptions: AzureResourceSubscription[] = [];

			if (this._isClearingCache) {
				const credentials = await this.getCredentials();
				subscriptions = (await this.servicePool.subscriptionService.getSubscriptions(this.account, credentials)) || <AzureResourceSubscription[]>[];

				let cache = this.getCache<AzureResourceSubscriptionsCache>();
				if (!cache) {
					cache = { subscriptions: { } };
				}
				cache.subscriptions[this.account.key.accountId] = subscriptions;
				this.updateCache<AzureResourceSubscriptionsCache>(cache);

				this._isClearingCache = false;
			} else {
				subscriptions = await this.getCachedSubscriptions();
			}

			this._totalSubscriptionCount = subscriptions.length;

			let selectedSubscriptions = await this.servicePool.subscriptionFilterService.getSelectedSubscriptions(this.account);
			let selectedSubscriptionIds = (selectedSubscriptions || <AzureResourceSubscription[]>[]).map((subscription) => subscription.id);
			if (selectedSubscriptionIds.length > 0) {
				subscriptions = subscriptions.filter((subscription) => selectedSubscriptionIds.indexOf(subscription.id) !== -1);
				this._selectedSubscriptionCount = selectedSubscriptionIds.length;
			} else {
				// ALL subscriptions are listed by default
				this._selectedSubscriptionCount = this._totalSubscriptionCount;
			}

			this.refreshLabel();

			if (subscriptions.length === 0) {
				return [AzureResourceMessageTreeNode.create(AzureResourceAccountTreeNode.NoSubscriptions, this)];
			} else {
				return subscriptions.map((subscription) => new AzureResourceSubscriptionTreeNode(subscription, this.account, this.treeChangeHandler, this));
			}
		} catch (error) {
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public async getCachedSubscriptions(): Promise<AzureResourceSubscription[]> {
		const subscriptions: AzureResourceSubscription[] = [];
		const cache = this.getCache<AzureResourceSubscriptionsCache>();
		if (cache) {
			subscriptions.push(...cache.subscriptions[this.account.key.accountId]);
		}
		return subscriptions;
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		let item = new TreeItem(this._label, TreeItemCollapsibleState.Collapsed);
		item.id = this._id;
		item.contextValue = AzureResourceItemType.account;
		item.iconPath = {
			dark: this.servicePool.contextService.getAbsolutePath('resources/dark/account_inverse.svg'),
			light: this.servicePool.contextService.getAbsolutePath('resources/light/account.svg')
		};
		return item;
	}

	public getNodeInfo(): NodeInfo {
		return {
			label: this._label,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.account,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.account
		};
	}

	public get nodePathValue(): string {
		return this._id;
	}

	public get totalSubscriptionCount(): number {
		return this._totalSubscriptionCount;
	}

	public get selectedSubscriptionCount(): number {
		return this._selectedSubscriptionCount;
	}

	protected refreshLabel(): void {
		const newLabel = this.generateLabel();
		if (this._label !== newLabel) {
			this._label = newLabel;
			this.treeChangeHandler.notifyNodeChanged(this);
		}
	}

	protected get cacheKey(): string {
		return 'azureResource.cache.subscriptions';
	}

	private generateLabel(): string {
		let label = `${this.account.displayInfo.displayName} (${this.account.key.accountId})`;

		if (this._totalSubscriptionCount !== 0) {
			label += ` (${this._selectedSubscriptionCount} / ${this._totalSubscriptionCount} subscriptions)`;
		}

		return label;
	}

	private _id: string = undefined;
	private _label: string = undefined;
	private _totalSubscriptionCount = 0;
	private _selectedSubscriptionCount = 0;

	private static readonly NoSubscriptions = localize('azureResource.tree.accountTreeNode.noSubscriptions', 'No Subscriptions found.');
}

interface AzureResourceSubscriptionsCache {
	subscriptions: { [accountId: string]: AzureResourceSubscription[] };
}

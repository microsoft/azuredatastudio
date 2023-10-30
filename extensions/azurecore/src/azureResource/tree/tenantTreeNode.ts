/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AppContext } from '../../appContext';
import { TreeNode } from '../treeNode';
import { AzureSubscriptionError } from '../errors';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType, AzureResourceServiceNames } from '../constants';
import { AzureResourceSubscriptionTreeNode } from './subscriptionTreeNode';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { AzureResourceErrorMessageUtil } from '../utils';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService } from '../../azureResource/interfaces';
import { AzureAccount, Tenant, azureResource } from 'azurecore';
import { AzureResourceAccountTreeNode } from './accountTreeNode';

export class AzureResourceTenantTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly account: AzureAccount,
		public readonly tenant: Tenant,
		parentNode: AzureResourceAccountTreeNode,
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler
	) {
		super(appContext, treeChangeHandler, parentNode);

		this._subscriptionService = this.appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
		this._subscriptionFilterService = this.appContext.getService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService);

		this._id = `account_${this.account.key.accountId}.tenant_${tenant.id}`;
		this.setCacheKey(`${this._id}.subscriptions`);
		this._label = this.generateLabel();
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let subscriptions: azureResource.AzureResourceSubscription[] = [];

			if (this._isClearingCache) {
				subscriptions = await this._subscriptionService.getSubscriptions(this.account, [this.tenant.id]);
				await this.updateCache<azureResource.AzureResourceSubscription[]>(subscriptions);
				this._isClearingCache = false;
			} else {
				subscriptions = await this.getCachedSubscriptions();
			}

			this._totalSubscriptionCount = subscriptions.length;

			const allSubscriptions = await this._subscriptionFilterService.getSelectedSubscriptions(this.account, this.tenant);
			const selectedSubscriptions = allSubscriptions?.filter(subscription => subscription.tenant === this.tenant.id);
			const selectedSubscriptionIds = (selectedSubscriptions || <azureResource.AzureResourceSubscription[]>[]).map((subscription) => subscription.id);
			if (selectedSubscriptionIds.length > 0) {
				subscriptions = subscriptions.filter((subscription) => selectedSubscriptionIds.indexOf(subscription.id) !== -1);
				this._selectedSubscriptionCount = selectedSubscriptionIds.length;
			} else {
				// ALL subscriptions are listed by default
				this._selectedSubscriptionCount = this._totalSubscriptionCount;
			}

			this.refreshLabel();

			if (subscriptions.length === 0) {
				return [AzureResourceMessageTreeNode.create(AzureResourceTenantTreeNode.noSubscriptionsLabel, this)];
			} else {
				let subTreeNodes = await Promise.all(subscriptions.map(async (subscription) => {
					return new AzureResourceSubscriptionTreeNode(this.account, subscription, this.tenant, this.appContext, this.treeChangeHandler, this);
				}));
				return subTreeNodes.sort((a, b) => a.subscription.name.localeCompare(b.subscription.name));
			}
		} catch (error) {
			if (error instanceof AzureSubscriptionError) {
				void vscode.commands.executeCommand('azure.resource.signin');
			}
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public async getCachedSubscriptions(): Promise<azureResource.AzureResourceSubscription[]> {
		return this.getCache<azureResource.AzureResourceSubscription[]>() ?? [];
	}

	public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		const item = new vscode.TreeItem(this._label, vscode.TreeItemCollapsibleState.Collapsed);
		item.id = this._id;
		item.contextValue = AzureResourceItemType.tenant;
		item.iconPath = this.appContext.extensionContext.asAbsolutePath('resources/tenant.svg');
		return item;
	}

	public getNodeInfo(): azdata.NodeInfo {
		return {
			label: this._label,
			isLeaf: false,
			errorMessage: undefined,
			metadata: undefined,
			nodePath: this.generateNodePath(),
			parentNodePath: this.parent?.generateNodePath() ?? '',
			nodeStatus: undefined,
			nodeType: AzureResourceItemType.tenant,
			nodeSubType: undefined,
			iconType: AzureResourceItemType.tenant
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

	private generateLabel(): string {
		let label = this.tenant.displayName;

		if (this._totalSubscriptionCount !== 0) {
			label += ` (${this._selectedSubscriptionCount} / ${this._totalSubscriptionCount} subscriptions)`;
		}

		return label;
	}

	private _subscriptionService: IAzureResourceSubscriptionService;
	private _subscriptionFilterService: IAzureResourceSubscriptionFilterService;

	private _id: string;
	private _label: string;
	private _totalSubscriptionCount = 0;
	private _selectedSubscriptionCount = 0;

	private static readonly noSubscriptionsLabel = localize('azure.resource.tree.accountTreeNode.noSubscriptionsLabel', "No Subscriptions found.");

	sleep(ms: number) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

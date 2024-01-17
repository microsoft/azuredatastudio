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
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService } from '../interfaces';
import { AzureAccount, Tenant, azureResource } from 'azurecore';
import { AzureResourceService } from '../resourceService';
import { AzureResourceResourceTreeNode } from '../resourceTreeNode';
import { AzureResourceErrorMessageUtil } from '../utils';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { FlatAccountTreeNode } from './flatAccountTreeNode';

export class FlatTenantTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly account: AzureAccount,
		public readonly tenant: Tenant,
		private readonly parentNode: FlatAccountTreeNode | undefined,
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler,
	) {
		super(appContext, treeChangeHandler, parentNode);

		this._subscriptionService = this.appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
		this._subscriptionFilterService = this.appContext.getService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService);
		this._resourceService = this.appContext.getService<AzureResourceService>(AzureResourceServiceNames.resourceService);

		this._id = `account_${this.account.key.accountId}.tenant_${tenant.id}`;
		this.setCacheKey(`${this._id}.dataresources`);
		this._label = this.generateLabel();
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let nodesResult: TreeNode[] = [];
			let subscriptions: azureResource.AzureResourceSubscription[] = [];
			if (this._isClearingCache) {
				subscriptions = await this._subscriptionService.getSubscriptions(this.account, [this.tenant.id]);
				await this.updateCache<azureResource.AzureResourceSubscription[]>(subscriptions);
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

			if (this._isClearingCache) {
				this._isClearingCache = false;
				return [];
			}

			if (subscriptions.length === 0) {
				nodesResult = [AzureResourceMessageTreeNode.create(FlatTenantTreeNode.noSubscriptionsLabel, this)];
			} else {
				let _nodes: AzureResourceResourceTreeNode[] = [];
				const resources = await this._resourceService.getAllChildren(this.account, subscriptions, true);
				if (resources?.length > 0) {
					_nodes.push(...resources.map(dr => new AzureResourceResourceTreeNode(dr, this.parentNode ?? this, this.appContext)));
					_nodes = _nodes.sort((a, b) => {
						return a.getNodeInfo().label.localeCompare(b.getNodeInfo().label);
					});
				}
				nodesResult = _nodes;
			}

			return nodesResult;
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

	private _subscriptionService: IAzureResourceSubscriptionService;
	private _subscriptionFilterService: IAzureResourceSubscriptionFilterService;
	private _resourceService: AzureResourceService;

	private _id: string;
	private _label: string;
	public _totalSubscriptionCount = 0;
	public _selectedSubscriptionCount = 0;

	private static readonly noSubscriptionsLabel = localize('azure.resource.tree.accountTreeNode.noSubscriptionsLabel', "No Subscriptions found.");
}

export async function getSubscriptionInfo(account: AzureAccount, tenant: Tenant, subscriptionService: IAzureResourceSubscriptionService, subscriptionFilterService: IAzureResourceSubscriptionFilterService): Promise<{
	subscriptions: azureResource.AzureResourceSubscription[],
	total: number,
	selected: number
}> {
	let subscriptions = await subscriptionService.getSubscriptions(account, [tenant.id]);
	const total = subscriptions.length;
	let selected = total;

	const selectedSubscriptions = await subscriptionFilterService.getSelectedSubscriptions(account, tenant);
	const selectedSubscriptionIds = (selectedSubscriptions || <azureResource.AzureResourceSubscription[]>[]).map((subscription) => subscription.id);
	if (selectedSubscriptionIds.length > 0) {
		subscriptions = subscriptions.filter((subscription) => selectedSubscriptionIds.indexOf(subscription.id) !== -1);
		selected = selectedSubscriptionIds.length;
	}
	return {
		subscriptions,
		total,
		selected
	};
}

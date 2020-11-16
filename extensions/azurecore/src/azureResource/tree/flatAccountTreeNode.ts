/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { TokenCredentials } from '@azure/ms-rest-js';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AppContext } from '../../appContext';
import { azureResource } from 'azureResource';
import { TreeNode } from '../treeNode';
import { AzureResourceCredentialError } from '../errors';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType, AzureResourceServiceNames } from '../constants';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService, IAzureResourceNodeWithProviderId } from '../../azureResource/interfaces';
import { AzureAccount } from '../../account-provider/interfaces';
import { AzureResourceService } from '../resourceService';
import { AzureResourceResourceTreeNode } from '../resourceTreeNode';
import { AzureResourceErrorMessageUtil } from '../utils';

export class FlatAccountTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly account: AzureAccount,
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler
	) {
		super(appContext, treeChangeHandler, undefined);

		this._subscriptionService = this.appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
		this._subscriptionFilterService = this.appContext.getService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService);
		this._resourceService = this.appContext.getService<AzureResourceService>(AzureResourceServiceNames.resourceService);

		this._id = `account_${this.account.key.accountId}`;
		this.setCacheKey(`${this._id}.dataresources`);
		this._label = account.displayInfo.displayName;
	}

	public async updateLabel(): Promise<void> {
		const subscriptionInfo = await this.getSubscriptionInfo();
		if (subscriptionInfo.total !== 0) {
			this._label = localize({
				key: 'azure.resource.tree.accountTreeNode.title',
				comment: [
					'{0} is the display name of the azure account',
					'{1} is the number of selected subscriptions in this account',
					'{2} is the number of total subscriptions in this account'
				]
			}, "{0} ({1}/{2} subscriptions)", this.account.displayInfo.displayName, subscriptionInfo.selected, subscriptionInfo.total);
		} else {
			this._label = this.account.displayInfo.displayName;
		}
	}

	private async getSubscriptionInfo(): Promise<{
		subscriptions: azureResource.AzureResourceSubscription[],
		total: number,
		selected: number
	}> {
		let subscriptions: azureResource.AzureResourceSubscription[] = [];
		try {
			for (const tenant of this.account.properties.tenants) {
				const token = await azdata.accounts.getAccountSecurityToken(this.account, tenant.id, azdata.AzureResource.ResourceManagement);

				subscriptions.push(...(await this._subscriptionService.getSubscriptions(this.account, new TokenCredentials(token.token, token.tokenType), tenant.id) || <azureResource.AzureResourceSubscription[]>[]));
			}
		} catch (error) {
			throw new AzureResourceCredentialError(localize('azure.resource.tree.accountTreeNode.credentialError', "Failed to get credential for account {0}. Please refresh the account.", this.account.key.accountId), error);
		}
		const total = subscriptions.length;
		let selected = total;

		const selectedSubscriptions = await this._subscriptionFilterService.getSelectedSubscriptions(this.account);
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

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let dataResources: IAzureResourceNodeWithProviderId[] = [];
			if (this._isClearingCache) {
				let subscriptions: azureResource.AzureResourceSubscription[] = (await this.getSubscriptionInfo()).subscriptions;

				if (subscriptions.length === 0) {
					return [AzureResourceMessageTreeNode.create(FlatAccountTreeNode.noSubscriptionsLabel, this)];
				} else {
					// Filter out everything that we can't authenticate to.
					subscriptions = subscriptions.filter(async s => {
						const token = await azdata.accounts.getAccountSecurityToken(this.account, s.tenant, azdata.AzureResource.ResourceManagement);
						if (!token) {
							console.info(`Account does not have permissions to view subscription ${JSON.stringify(s)}.`);
							return false;
						}
						return true;
					});
				}

				const resourceProviderIds = await this._resourceService.listResourceProviderIds();
				for (const subscription of subscriptions) {
					for (const providerId of resourceProviderIds) {
						const resourceTypes = await this._resourceService.getRootChildren(providerId, this.account, subscription, subscription.tenant);
						for (const resourceType of resourceTypes) {
							dataResources.push(...await this._resourceService.getChildren(providerId, resourceType.resourceNode));
						}
					}
				}
				dataResources = dataResources.sort((a, b) => { return a.resourceNode.treeItem.label.localeCompare(b.resourceNode.treeItem.label); });
				this.updateCache(dataResources);
				this._isClearingCache = false;
			} else {
				dataResources = this.getCache<IAzureResourceNodeWithProviderId[]>();
			}

			return dataResources.map(dr => new AzureResourceResourceTreeNode(dr, this, this.appContext));
		} catch (error) {
			if (error instanceof AzureResourceCredentialError) {
				vscode.commands.executeCommand('azure.resource.signin');
			}
			return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
		}
	}

	public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
		const item = new vscode.TreeItem(this._label, vscode.TreeItemCollapsibleState.Collapsed);
		item.id = this._id;
		item.contextValue = AzureResourceItemType.account;
		item.iconPath = {
			dark: this.appContext.extensionContext.asAbsolutePath('resources/dark/account_inverse.svg'),
			light: this.appContext.extensionContext.asAbsolutePath('resources/light/account.svg')
		};
		return item;
	}

	public getNodeInfo(): azdata.NodeInfo {
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

	private _subscriptionService: IAzureResourceSubscriptionService = undefined;
	private _subscriptionFilterService: IAzureResourceSubscriptionFilterService = undefined;
	private _resourceService: AzureResourceService = undefined;

	private _id: string = undefined;
	private _label: string = undefined;

	private static readonly noSubscriptionsLabel = localize('azure.resource.tree.accountTreeNode.noSubscriptionsLabel', "No Subscriptions found.");
}

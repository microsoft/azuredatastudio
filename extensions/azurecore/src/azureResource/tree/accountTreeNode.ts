/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Account, NodeInfo, azureResource, AzureResource } from 'sqlops';
import { TokenCredentials } from 'ms-rest';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { AzureResourceCredentialError } from '../errors';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType } from '../constants';
import { AzureResourceSubscriptionTreeNode } from './subscriptionTreeNode';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { AzureResourceErrorMessageUtil } from '../utils';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { treeLocalizationIdPrefix } from './constants';

export class AzureResourceAccountTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly account: Account,
		treeChangeHandler: IAzureResourceTreeChangeHandler
	) {
		super(treeChangeHandler, undefined);

		this._id = `account_${this.account.key.accountId}`;
		this.setCacheKey(`${this._id}.subscriptions`);
		this._label = this.generateLabel();
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let subscriptions: azureResource.AzureResourceSubscription[] = [];

			if (this._isClearingCache) {
				try {
				    const tokens = await this.servicePool.apiWrapper.getSecurityToken(this.account, AzureResource.ResourceManagement);

					for (const tenant of this.account.properties.tenants) {
						const token = tokens[tenant.id].token;
						const tokenType = tokens[tenant.id].tokenType;

						subscriptions.push(...await this.servicePool.subscriptionService.getSubscriptions(this.account, new TokenCredentials(token, tokenType)));
					}
				} catch (error) {
					throw new AzureResourceCredentialError(localize(`${AzureResourceAccountTreeNode.localizationIdPrefix}.credentialError`, 'Failed to get credential for account {0}. Please refresh the account.', this.account.key.accountId), error);
				}

				this.updateCache<azureResource.AzureResourceSubscription[]>(subscriptions);

				this._isClearingCache = false;
			} else {
				subscriptions = await this.getCachedSubscriptions();
			}

			this._totalSubscriptionCount = subscriptions.length;

			const selectedSubscriptions = await this.servicePool.subscriptionFilterService.getSelectedSubscriptions(this.account);
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
				return [AzureResourceMessageTreeNode.create(AzureResourceAccountTreeNode.noSubscriptionsLabel, this)];
			} else {
				return await Promise.all(subscriptions.map(async (subscription) => {
					const tenantId = await this.servicePool.tenantServicxe.getTenantId(subscription);

					return new AzureResourceSubscriptionTreeNode(this.account, subscription, tenantId, this.treeChangeHandler, this);
				}));
			}
		} catch (error) {
			if (error instanceof AzureResourceCredentialError) {
				this.servicePool.apiWrapper.showErrorMessage(error.message);

				this.servicePool.apiWrapper.executeCommand('azure.resource.signin');
			} else {
				return [AzureResourceMessageTreeNode.create(AzureResourceErrorMessageUtil.getErrorMessage(error), this)];
			}
		}
	}

	public async getCachedSubscriptions(): Promise<azureResource.AzureResourceSubscription[]> {
		return this.getCache<azureResource.AzureResourceSubscription[]>();
	}

	public getTreeItem(): TreeItem | Promise<TreeItem> {
		const item = new TreeItem(this._label, TreeItemCollapsibleState.Collapsed);
		item.id = this._id;
		item.contextValue = AzureResourceItemType.account;
		item.iconPath = {
			dark: this.servicePool.extensionContext.asAbsolutePath('resources/dark/account_inverse.svg'),
			light: this.servicePool.extensionContext.asAbsolutePath('resources/light/account.svg')
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

	private static readonly localizationIdPrefix = `${treeLocalizationIdPrefix}.accountTreeNode`;

	private static readonly noSubscriptionsLabel = localize(`${AzureResourceAccountTreeNode.localizationIdPrefix}.noSubscriptionsLabel`, 'No Subscriptions found.');
}
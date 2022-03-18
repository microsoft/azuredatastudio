/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AppContext } from '../../appContext';
import { azureResource } from 'azureResource';
import { TreeNode } from '../treeNode';
import { AzureSubscriptionError } from '../errors';
import { AzureResourceContainerTreeNodeBase } from './baseTreeNodes';
import { AzureResourceItemType, AzureResourceServiceNames } from '../constants';
import { AzureResourceSubscriptionTreeNode } from './subscriptionTreeNode';
import { AzureResourceMessageTreeNode } from '../messageTreeNode';
import { AzureResourceErrorMessageUtil } from '../utils';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService } from '../../azureResource/interfaces';
import { AzureAccount } from 'azurecore';

export class AzureResourceAccountTreeNode extends AzureResourceContainerTreeNodeBase {
	public constructor(
		public readonly account: AzureAccount,
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler
	) {
		super(appContext, treeChangeHandler, undefined);

		this._subscriptionService = this.appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
		this._subscriptionFilterService = this.appContext.getService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService);

		this._id = `account_${this.account.key.accountId}`;
		this.setCacheKey(`${this._id}.subscriptions`);
		this._label = this.generateLabel();
	}

	public async getChildren(): Promise<TreeNode[]> {
		try {
			let subscriptions: azureResource.AzureResourceSubscription[] = [];

			if (this._isClearingCache) {
				subscriptions = await this._subscriptionService.getSubscriptions(this.account);
				await this.updateCache<azureResource.AzureResourceSubscription[]>(subscriptions);
				this._isClearingCache = false;
			} else {
				subscriptions = await this.getCachedSubscriptions();
			}

			this._totalSubscriptionCount = subscriptions.length;

			const selectedSubscriptions = await this._subscriptionFilterService.getSelectedSubscriptions(this.account);
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
				// Filter out everything that we can't authenticate to.
				const hasTokenResults = await Promise.all(subscriptions.map(async s => {
					let token: azdata.accounts.AccountSecurityToken | undefined = undefined;
					let errMsg = '';
					try {
						token = await azdata.accounts.getAccountSecurityToken(this.account, s.tenant, azdata.AzureResource.ResourceManagement);
					} catch (err) {
						errMsg = AzureResourceErrorMessageUtil.getErrorMessage(err);
					}
					if (!token) {
						void vscode.window.showWarningMessage(localize('azure.unableToAccessSubscription', "Unable to access subscription {0} ({1}). Please [refresh the account](command:azure.resource.signin) to try again. {2}", s.name, s.id, errMsg));
						return false;
					}
					return true;
				}));
				subscriptions = subscriptions.filter((_s, i) => hasTokenResults[i]);

				let subTreeNodes = await Promise.all(subscriptions.map(async (subscription) => {
					return new AzureResourceSubscriptionTreeNode(this.account, subscription, subscription.tenant, this.appContext, this.treeChangeHandler, this);
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
		return this.getCache<azureResource.AzureResourceSubscription[]>();
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
		let label = this.account.displayInfo.displayName;

		if (this._totalSubscriptionCount !== 0) {
			label += ` (${this._selectedSubscriptionCount} / ${this._totalSubscriptionCount} subscriptions)`;
		}

		return label;
	}

	private _subscriptionService: IAzureResourceSubscriptionService = undefined;
	private _subscriptionFilterService: IAzureResourceSubscriptionFilterService = undefined;

	private _id: string = undefined;
	private _label: string = undefined;
	private _totalSubscriptionCount = 0;
	private _selectedSubscriptionCount = 0;

	private static readonly noSubscriptionsLabel = localize('azure.resource.tree.accountTreeNode.noSubscriptionsLabel', "No Subscriptions found.");
}

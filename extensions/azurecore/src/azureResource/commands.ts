/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { window, QuickPickItem } from 'vscode';
import { AzureResource } from 'sqlops';
import { TokenCredentials } from 'ms-rest';
import { AppContext } from '../appContext';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { azureResource } from './azure-resource';
import { TreeNode } from './treeNode';
import { AzureResourceCredentialError } from './errors';
import { AzureResourceTreeProvider } from './tree/treeProvider';
import { AzureResourceAccountTreeNode } from './tree/accountTreeNode';
import { IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService } from '../azureResource/interfaces';
import { AzureResourceServiceNames } from './constants';

export function registerAzureResourceCommands(appContext: AppContext, tree: AzureResourceTreeProvider): void {
	appContext.apiWrapper.registerCommand('azure.resource.selectsubscriptions', async (node?: TreeNode) => {
		if (!(node instanceof AzureResourceAccountTreeNode)) {
			return;
		}

		const subscriptionService = appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
		const subscriptionFilterService = appContext.getService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService);

		const accountNode = node as AzureResourceAccountTreeNode;

		const subscriptions = (await accountNode.getCachedSubscriptions()) || <azureResource.AzureResourceSubscription[]>[];
		if (subscriptions.length === 0) {
			try {
				const tokens = await this.servicePool.apiWrapper.getSecurityToken(this.account, AzureResource.ResourceManagement);

				for (const tenant of this.account.properties.tenants) {
					const token = tokens[tenant.id].token;
					const tokenType = tokens[tenant.id].tokenType;

					subscriptions.push(...await subscriptionService.getSubscriptions(accountNode.account, new TokenCredentials(token, tokenType)));
				}
			} catch (error) {
				throw new AzureResourceCredentialError(localize('azure.resource.selectsubscriptions.credentialError', 'Failed to get credential for account {0}. Please refresh the account.', this.account.key.accountId), error);
			}
		}

		let selectedSubscriptions = (await subscriptionFilterService.getSelectedSubscriptions(accountNode.account)) || <azureResource.AzureResourceSubscription[]>[];
		const selectedSubscriptionIds: string[] = [];
		if (selectedSubscriptions.length > 0) {
			selectedSubscriptionIds.push(...selectedSubscriptions.map((subscription) => subscription.id));
		} else {
			// ALL subscriptions are selected by default
			selectedSubscriptionIds.push(...subscriptions.map((subscription) => subscription.id));
		}

		interface AzureResourceSubscriptionQuickPickItem extends QuickPickItem {
			subscription: azureResource.AzureResourceSubscription;
		}

		const subscriptionQuickPickItems: AzureResourceSubscriptionQuickPickItem[] = subscriptions.map((subscription) => {
			return {
				label: subscription.name,
				picked: selectedSubscriptionIds.indexOf(subscription.id) !== -1,
				subscription: subscription
			};
		});

		const selectedSubscriptionQuickPickItems = (await window.showQuickPick(subscriptionQuickPickItems, { canPickMany: true }));
		if (selectedSubscriptionQuickPickItems && selectedSubscriptionQuickPickItems.length > 0) {
			tree.refresh(node, false);

			selectedSubscriptions = selectedSubscriptionQuickPickItems.map((subscriptionItem) => subscriptionItem.subscription);
			await subscriptionFilterService.saveSelectedSubscriptions(accountNode.account, selectedSubscriptions);
		}
	});

	appContext.apiWrapper.registerCommand('azure.resource.refreshall', () => tree.notifyNodeChanged(undefined));

	appContext.apiWrapper.registerCommand('azure.resource.refresh', async (node?: TreeNode) => {
		tree.refresh(node, true);
	});

	appContext.apiWrapper.registerCommand('azure.resource.signin', async (node?: TreeNode) => {
		appContext.apiWrapper.executeCommand('sql.action.accounts.manageLinkedAccount');
	});
}

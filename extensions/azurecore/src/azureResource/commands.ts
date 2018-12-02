/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { window, QuickPickItem } from 'vscode';
import { azureResource, AzureResource } from 'sqlops';
import { TreeNode } from './treeNode';
import { TokenCredentials } from 'ms-rest';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceCredentialError } from './errors';
import { AzureResourceTreeProvider } from './tree/treeProvider';
import { AzureResourceAccountTreeNode } from './tree/accountTreeNode';
import { AzureResourceServicePool } from './servicePool';

export function registerAzureResourceCommands(tree: AzureResourceTreeProvider): void {
	const servicePool = AzureResourceServicePool.getInstance();

	servicePool.apiWrapper.registerCommand('azure.resource.selectsubscriptions', async (node?: TreeNode) => {
		if (!(node instanceof AzureResourceAccountTreeNode)) {
			return;
		}

		const accountNode = node as AzureResourceAccountTreeNode;

		let subscriptions = await accountNode.getCachedSubscriptions();
		if (!subscriptions || subscriptions.length === 0) {
			const credentials: TokenCredentials[] = [];

			try {
				const tokens = await this.servicePool.apiWrapper.getSecurityToken(this.account, AzureResource.ResourceManagement);

				for (const tenant of this.account.properties.tenants) {
					const token = tokens[tenant.id].token;
					const tokenType = tokens[tenant.id].tokenType;

					credentials.push(new TokenCredentials(token, tokenType));
				}
			} catch (error) {
				throw new AzureResourceCredentialError(localize('azure.resource.selectsubscriptions.credentialError', 'Failed to get credential for account {0}. Please refresh the account.', this.account.key.accountId), error);
			}

			subscriptions = await servicePool.subscriptionService.getSubscriptions(accountNode.account, credentials);
		}

		const selectedSubscriptions = (await servicePool.subscriptionFilterService.getSelectedSubscriptions(accountNode.account)) || <azureResource.AzureResourceSubscription[]>[];
		const selectedSubscriptionIds: string[] = [];
		if (selectedSubscriptions.length > 0) {
			selectedSubscriptionIds.push(...selectedSubscriptions.map((subscription) => subscription.id));
		} else {
			// ALL subscriptions are selected by default
			selectedSubscriptionIds.push(...subscriptions.map((subscription) => subscription.id));
		}

		interface SubscriptionQuickPickItem extends QuickPickItem {
			subscription: azureResource.AzureResourceSubscription;
		}

		const subscriptionItems: SubscriptionQuickPickItem[] = subscriptions.map((subscription) => {
			return {
				label: subscription.name,
				picked: selectedSubscriptionIds.indexOf(subscription.id) !== -1,
				subscription: subscription
			};
		});

		const pickedSubscriptionItems = (await window.showQuickPick(subscriptionItems, { canPickMany: true }));
		if (pickedSubscriptionItems && pickedSubscriptionItems.length > 0) {
			tree.refresh(node, false);

			const pickedSubscriptions = pickedSubscriptionItems.map((subscriptionItem) => subscriptionItem.subscription);
			await servicePool.subscriptionFilterService.saveSelectedSubscriptions(accountNode.account, pickedSubscriptions);
		}
	});

	servicePool.apiWrapper.registerCommand('azure.resource.refreshall', () => tree.notifyNodeChanged(undefined));

	servicePool.apiWrapper.registerCommand('azure.resource.refresh', async (node?: TreeNode) => {
		tree.refresh(node, true);
	});

	servicePool.apiWrapper.registerCommand('azure.resource.signin', async (node?: TreeNode) => {
		servicePool.apiWrapper.executeCommand('sql.action.accounts.manageLinkedAccount');
	});
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { window, QuickPickItem } from 'vscode';
import * as azdata from 'azdata';
import { TokenCredentials } from '@azure/ms-rest-js';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AppContext } from '../appContext';
import { azureResource } from './azure-resource';
import { TreeNode } from './treeNode';
import { AzureResourceCredentialError } from './errors';
import { AzureResourceTreeProvider } from './tree/treeProvider';
import { AzureResourceAccountTreeNode } from './tree/accountTreeNode';
import { IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService, IAzureTerminalService } from '../azureResource/interfaces';
import { AzureResourceServiceNames } from './constants';
import { AzureResourceGroupService } from './providers/resourceGroup/resourceGroupService';
import { GetSubscriptionsResult, GetResourceGroupsResult } from '../azurecore';
import { isArray } from 'util';
import { AzureAccount, Tenant } from '../account-provider/interfaces';

export function registerAzureResourceCommands(appContext: AppContext, tree: AzureResourceTreeProvider): void {
	appContext.apiWrapper.registerCommand('azure.resource.startterminal', async (node?: TreeNode) => {
		try {
			if (!node || !(node instanceof AzureResourceAccountTreeNode)) {
				return;
			}

			const accountNode = node as AzureResourceAccountTreeNode;
			const azureAccount = accountNode.account as AzureAccount;

			const tokens = await appContext.apiWrapper.getSecurityToken(azureAccount, azdata.AzureResource.MicrosoftResourceManagement);

			const terminalService = appContext.getService<IAzureTerminalService>(AzureResourceServiceNames.terminalService);

			const listOfTenants = azureAccount.properties.tenants.map(t => t.displayName);

			if (listOfTenants.length === 0) {
				window.showErrorMessage(localize('azure.noTenants', "A tenant is required for this feature. Your Azure subscription seems to have no tenants."));
				return;
			}

			let tenant: Tenant;
			window.setStatusBarMessage(localize('azure.startingCloudShell', "Starting cloud shell…"), 5000);

			if (listOfTenants.length === 1) {
				// Don't show quickpick for a single option
				tenant = azureAccount.properties.tenants[0];
			} else {
				const pickedTenant = await window.showQuickPick(listOfTenants, { canPickMany: false });

				if (!pickedTenant) {
					window.showErrorMessage(localize('azure.mustPickTenant', "You must select a tenant for this feature to work."));
					return;
				}

				// The tenant the user picked
				tenant = azureAccount.properties.tenants[listOfTenants.indexOf(pickedTenant)];
			}

			await terminalService.getOrCreateCloudConsole(azureAccount, tenant, tokens);
		} catch (ex) {
			console.error(ex);
			window.showErrorMessage(ex);
		}
	});

	// Resource Management commands
	appContext.apiWrapper.registerCommand('azure.accounts.getSubscriptions', async (account?: azdata.Account, ignoreErrors: boolean = false): Promise<GetSubscriptionsResult> => {
		const result: GetSubscriptionsResult = { subscriptions: [], errors: [] };
		if (!account?.properties?.tenants || !isArray(account.properties.tenants)) {
			const error = new Error(localize('azure.accounts.getSubscriptions.invalidParamsError', "Invalid account"));
			if (!ignoreErrors) {
				throw error;
			}
			result.errors.push(error);
			return result;
		}
		const subscriptionService = appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
		const tokens = await appContext.apiWrapper.getSecurityToken(account, azdata.AzureResource.ResourceManagement);
		await Promise.all(account.properties.tenants.map(async (tenant: { id: string | number; }) => {
			try {
				const token = tokens[tenant.id].token;
				const tokenType = tokens[tenant.id].tokenType;

				result.subscriptions.push(...await subscriptionService.getSubscriptions(account, new TokenCredentials(token, tokenType)));
			} catch (err) {
				const error = new Error(localize('azure.accounts.getSubscriptions.queryError', "Error fetching subscriptions for account {0} tenant {1} : {2}",
					account.displayInfo.displayName,
					tenant.id,
					err instanceof Error ? err.message : err));
				console.warn(error);
				if (!ignoreErrors) {
					throw error;
				}
				result.errors.push(error);
			}
			return Promise.resolve();
		}));
		return result;
	});

	appContext.apiWrapper.registerCommand('azure.accounts.getResourceGroups', async (account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription, ignoreErrors: boolean = false): Promise<GetResourceGroupsResult> => {
		const result: GetResourceGroupsResult = { resourceGroups: [], errors: [] };
		if (!account?.properties?.tenants || !isArray(account.properties.tenants) || !subscription) {
			const error = new Error(localize('azure.accounts.getResourceGroups.invalidParamsError', "Invalid account or subscription"));
			if (!ignoreErrors) {
				throw error;
			}
			result.errors.push(error);
			return result;
		}
		const service = new AzureResourceGroupService();
		await Promise.all(account.properties.tenants.map(async (tenant: { id: string | number; }) => {
			try {
				const tokens = await appContext.apiWrapper.getSecurityToken(account, azdata.AzureResource.ResourceManagement);
				const token = tokens[tenant.id].token;
				const tokenType = tokens[tenant.id].tokenType;

				result.resourceGroups.push(...await service.getResources(subscription, new TokenCredentials(token, tokenType), account));
			} catch (err) {
				const error = new Error(localize('azure.accounts.getResourceGroups.queryError', "Error fetching resource groups for account {0} ({1}) subscription {2} ({3}) tenant {4} : {5}",
					account.displayInfo.displayName,
					account.displayInfo.userId,
					subscription.id,
					subscription.name,
					tenant.id,
					err instanceof Error ? err.message : err));
				console.warn(error);
				if (!ignoreErrors) {
					throw error;
				}
				result.errors.push(error);
			}
			return Promise.resolve();
		}));

		return result;
	});

	// Resource Tree commands

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
				const tokens = await this.servicePool.apiWrapper.getSecurityToken(this.account, azdata.AzureResource.ResourceManagement);

				for (const tenant of this.account.properties.tenants) {
					const token = tokens[tenant.id].token;
					const tokenType = tokens[tenant.id].tokenType;

					subscriptions.push(...await subscriptionService.getSubscriptions(accountNode.account, new TokenCredentials(token, tokenType)));
				}
			} catch (error) {
				this.account.isStale = true;
				throw new AzureResourceCredentialError(localize('azure.resource.selectsubscriptions.credentialError', "Failed to get credential for account {0}. Please refresh the account.", this.account.key.accountId), error);
			}
		}

		let selectedSubscriptions = await subscriptionFilterService.getSelectedSubscriptions(accountNode.account);
		if (!selectedSubscriptions) {
			selectedSubscriptions = [];
		}

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
		}).sort((a, b) => a.label.localeCompare(b.label));

		const selectedSubscriptionQuickPickItems = await window.showQuickPick(subscriptionQuickPickItems, { canPickMany: true });
		if (selectedSubscriptionQuickPickItems && selectedSubscriptionQuickPickItems.length > 0) {
			await tree.refresh(node, false);

			selectedSubscriptions = selectedSubscriptionQuickPickItems.map((subscriptionItem) => subscriptionItem.subscription);
			await subscriptionFilterService.saveSelectedSubscriptions(accountNode.account, selectedSubscriptions);
		}
	});

	appContext.apiWrapper.registerCommand('azure.resource.refreshall', () => tree.notifyNodeChanged(undefined));

	appContext.apiWrapper.registerCommand('azure.resource.refresh', async (node?: TreeNode) => {
		await tree.refresh(node, true);
	});

	appContext.apiWrapper.registerCommand('azure.resource.signin', async (node?: TreeNode) => {
		appContext.apiWrapper.executeCommand('workbench.actions.modal.linkedAccount');
	});

	appContext.apiWrapper.registerCommand('azure.resource.connectsqlserver', async (node?: TreeNode) => {
		if (!node) {
			return;
		}

		const treeItem: azdata.TreeItem = await node.getTreeItem();
		if (!treeItem.payload) {
			return;
		}
		// Ensure connection is saved to the Connections list, then open connection dialog
		let connectionProfile = Object.assign({}, treeItem.payload, { saveProfile: true });
		const conn = await appContext.apiWrapper.openConnectionDialog(undefined, connectionProfile, { saveConnection: true, showDashboard: true });
		if (conn) {
			appContext.apiWrapper.executeCommand('workbench.view.connections');
		}
	});
}

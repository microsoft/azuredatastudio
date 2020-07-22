/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
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
import { AzureAccount, Tenant } from '../account-provider/interfaces';

export function registerAzureResourceCommands(appContext: AppContext, tree: AzureResourceTreeProvider): void {
	vscode.commands.registerCommand('azure.resource.startterminal', async (node?: TreeNode) => {
		try {
			const enablePreviewFeatures = vscode.workspace.getConfiguration('workbench').get('enablePreviewFeatures');
			if (!enablePreviewFeatures) {
				const msg = localize('azure.cloudTerminalPreview', "You must enable preview features in order to use Azure Cloud Shell.");
				vscode.window.showInformationMessage(msg);
				return;
			}
			if (!node || !(node instanceof AzureResourceAccountTreeNode)) {
				return;
			}

			const accountNode = node as AzureResourceAccountTreeNode;
			const azureAccount = accountNode.account as AzureAccount;


			const terminalService = appContext.getService<IAzureTerminalService>(AzureResourceServiceNames.terminalService);

			const listOfTenants = azureAccount.properties.tenants.map(t => t.displayName);

			if (listOfTenants.length === 0) {
				vscode.window.showErrorMessage(localize('azure.noTenants', "A tenant is required for this feature. Your Azure subscription seems to have no tenants."));
				return;
			}

			let tenant: Tenant;
			vscode.window.setStatusBarMessage(localize('azure.startingCloudShell', "Starting cloud shell…"), 5000);

			if (listOfTenants.length === 1) {
				// Don't show quickpick for a single option
				tenant = azureAccount.properties.tenants[0];
			} else {
				const pickedTenant = await vscode.window.showQuickPick(listOfTenants, { canPickMany: false });

				if (!pickedTenant) {
					vscode.window.showErrorMessage(localize('azure.mustPickTenant', "You must select a tenant for this feature to work."));
					return;
				}

				// The tenant the user picked
				tenant = azureAccount.properties.tenants[listOfTenants.indexOf(pickedTenant)];
			}

			await terminalService.getOrCreateCloudConsole(azureAccount, tenant);
		} catch (ex) {
			console.error(ex);
			vscode.window.showErrorMessage(ex);
		}
	});

	// Resource Tree commands

	vscode.commands.registerCommand('azure.resource.selectsubscriptions', async (node?: TreeNode) => {
		if (!(node instanceof AzureResourceAccountTreeNode)) {
			return;
		}

		const account = node.account;
		if (!account) {
			return;
		}

		const subscriptionService = appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
		const subscriptionFilterService = appContext.getService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService);

		const accountNode = node as AzureResourceAccountTreeNode;

		const subscriptions = (await accountNode.getCachedSubscriptions()) || <azureResource.AzureResourceSubscription[]>[];
		if (subscriptions.length === 0) {
			try {

				for (const tenant of account.properties.tenants) {
					const response = await azdata.accounts.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.ResourceManagement);

					const token = response.token;
					const tokenType = response.tokenType;

					subscriptions.push(...await subscriptionService.getSubscriptions(account, new TokenCredentials(token, tokenType), tenant.id));
				}
			} catch (error) {
				account.isStale = true;
				throw new AzureResourceCredentialError(localize('azure.resource.selectsubscriptions.credentialError', "Failed to get credential for account {0}. Please refresh the account.", account.displayInfo.displayName), error);
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

		interface AzureResourceSubscriptionQuickPickItem extends vscode.QuickPickItem {
			subscription: azureResource.AzureResourceSubscription;
		}

		const subscriptionQuickPickItems: AzureResourceSubscriptionQuickPickItem[] = subscriptions.map((subscription) => {
			return {
				label: subscription.name,
				picked: selectedSubscriptionIds.indexOf(subscription.id) !== -1,
				subscription: subscription
			};
		}).sort((a, b) => a.label.localeCompare(b.label));

		const selectedSubscriptionQuickPickItems = await vscode.window.showQuickPick(subscriptionQuickPickItems, { canPickMany: true });
		if (selectedSubscriptionQuickPickItems && selectedSubscriptionQuickPickItems.length > 0) {
			await tree.refresh(node, false);

			selectedSubscriptions = selectedSubscriptionQuickPickItems.map((subscriptionItem) => subscriptionItem.subscription);
			await subscriptionFilterService.saveSelectedSubscriptions(accountNode.account, selectedSubscriptions);
		}
	});

	vscode.commands.registerCommand('azure.resource.refreshall', () => tree.notifyNodeChanged(undefined));

	vscode.commands.registerCommand('azure.resource.refresh', async (node?: TreeNode) => {
		await tree.refresh(node, true);
	});

	vscode.commands.registerCommand('azure.resource.signin', async (node?: TreeNode) => {
		vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
	});

	vscode.commands.registerCommand('azure.resource.connectsqlserver', async (node?: TreeNode) => {
		if (!node) {
			return;
		}

		const treeItem: azdata.TreeItem = await node.getTreeItem();
		if (!treeItem.payload) {
			return;
		}
		// Ensure connection is saved to the Connections list, then open connection dialog
		let connectionProfile = Object.assign({}, treeItem.payload, { saveProfile: true });
		const conn = await azdata.connection.openConnectionDialog(undefined, connectionProfile, { saveConnection: true, showDashboard: true });
		if (conn) {
			vscode.commands.executeCommand('workbench.view.connections');
		}
	});

	vscode.commands.registerCommand('azure.resource.openInAzurePortal', async (connectionProfile: azdata.IConnectionProfile) => {

		if (
			!connectionProfile.azureResourceId ||
			!connectionProfile.azurePortalEndpoint ||
			!connectionProfile.azureTenantId
		) {
			return;
		}

		const urlToOpen = `${connectionProfile.azurePortalEndpoint}//${connectionProfile.azureTenantId}/#resource/${connectionProfile.azureResourceId}`;
		vscode.env.openExternal(vscode.Uri.parse(urlToOpen));
	});
}

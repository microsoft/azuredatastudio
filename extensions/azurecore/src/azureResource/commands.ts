/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AppContext } from '../appContext';
import { TreeNode } from './treeNode';
import { AzureResourceTreeProvider } from './tree/treeProvider';
import { AzureResourceAccountTreeNode } from './tree/accountTreeNode';
import { IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService, IAzureTerminalService, IAzureResourceTenantFilterService } from '../azureResource/interfaces';
import { AzureResourceServiceNames } from './constants';
import { AzureAccount, Tenant, azureResource } from 'azurecore';
import { FlatTenantTreeNode } from './tree/flatTenantTreeNode';
import { ConnectionDialogTreeProvider } from './tree/connectionDialogTreeProvider';
import { AzureResourceErrorMessageUtil, filterAccounts } from './utils';
import { AzureResourceTenantTreeNode } from './tree/tenantTreeNode';
import { FlatAccountTreeNode } from './tree/flatAccountTreeNode';

export function registerAzureResourceCommands(appContext: AppContext, azureViewTree: AzureResourceTreeProvider, connectionDialogTree: ConnectionDialogTreeProvider, authLibrary: string): void {
	const trees = [azureViewTree, connectionDialogTree];
	vscode.commands.registerCommand('azure.resource.startterminal', async (node?: TreeNode) => {
		try {
			const enablePreviewFeatures = vscode.workspace.getConfiguration('workbench').get('enablePreviewFeatures');
			if (!enablePreviewFeatures) {
				const msg = localize('azure.cloudTerminalPreview', "You must enable preview features in order to use Azure Cloud Shell.");
				void vscode.window.showInformationMessage(msg);
				return;
			}
			let azureAccount: AzureAccount | undefined;
			if (node instanceof AzureResourceAccountTreeNode) {
				azureAccount = node.account;
			} else {
				let accounts = filterAccounts(await azdata.accounts.getAllAccounts(), authLibrary);
				accounts = accounts.filter(a => a.key.providerId.startsWith('azure'));
				if (accounts.length === 0) {
					const signin = localize('azure.signIn', "Sign in");
					const action = await vscode.window.showErrorMessage(localize('azure.noAccountError', "You are not currently signed into any Azure accounts, Please sign in and then try again."),
						signin);
					if (action === signin) {
						void vscode.commands.executeCommand('azure.resource.signin');
					}
					return;
				} else if (accounts.length === 1) {
					azureAccount = accounts[0];
				} else {
					const pickedAccount = await vscode.window.showQuickPick(accounts.map(account => account.displayInfo.displayName), {
						canPickMany: false,
						placeHolder: localize('azure.pickAnAzureAccount', "Select an Azure account")
					});
					if (!pickedAccount) {
						void vscode.window.showErrorMessage(localize('azure.accountNotSelectedError', "You must select an Azure account for this feature to work."));
						return;
					}
					azureAccount = accounts.find(acct => acct.displayInfo.displayName === pickedAccount);
				}
			}
			if (!azureAccount) {
				throw new Error('No Azure Account chosen');
			}
			const terminalService = appContext.getService<IAzureTerminalService>(AzureResourceServiceNames.terminalService);

			const listOfTenants = azureAccount.properties.tenants.map(t => t.displayName);

			if (listOfTenants.length === 0) {
				void vscode.window.showErrorMessage(localize('azure.noTenants', "A tenant is required for this feature. Your Azure subscription seems to have no tenants."));
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
					void vscode.window.showErrorMessage(localize('azure.mustPickTenant', "You must select a tenant for this feature to work."));
					return;
				}

				// The tenant the user picked
				tenant = azureAccount.properties.tenants[listOfTenants.indexOf(pickedTenant)];
			}

			await terminalService.getOrCreateCloudConsole(azureAccount, tenant);
		} catch (ex) {
			console.error(ex);
			void vscode.window.showErrorMessage(ex);
		}
	});

	// Resource Tree commands
	// Supports selecting subscriptions from single tenant account tree nodes or tenant tree node.
	vscode.commands.registerCommand('azure.resource.selectsubscriptions', async (node?: TreeNode) => {
		if (!(node instanceof AzureResourceAccountTreeNode) && !(node instanceof FlatAccountTreeNode)
			&& !(node instanceof AzureResourceTenantTreeNode) && !(node instanceof FlatTenantTreeNode)) {
			return;
		}

		const account = node.account;

		// Select first tenant from single tenant accounts
		let tenant = node.account.properties.tenants[0];
		if (node instanceof AzureResourceTenantTreeNode || node instanceof FlatTenantTreeNode) {
			tenant = node.tenant;
		}
		if (!account || !tenant) {
			return;
		}

		const subscriptionService = appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
		const subscriptionFilterService = appContext.getService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService);

		let subscriptions: azureResource.AzureResourceSubscription[] = [];
		if (subscriptions.length === 0) {
			try {
				let tenantIds = tenant ? [tenant.id] : account.properties.tenants.flatMap(t => t.id);
				subscriptions = await subscriptionService.getSubscriptions(account, tenantIds);
			} catch (error) {
				account.isStale = true;
				void vscode.window.showErrorMessage(AzureResourceErrorMessageUtil.getErrorMessage(error));
				return;
			}
		}

		let selectedSubscriptions = await subscriptionFilterService.getSelectedSubscriptions(account, tenant);
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
			for (const tree of trees) {
				await tree.refresh(undefined, false);
			}

			selectedSubscriptions = selectedSubscriptionQuickPickItems.map((subscriptionItem) => subscriptionItem.subscription);
			await subscriptionFilterService.saveSelectedSubscriptions(account, tenant, selectedSubscriptions);
		}
	});

	vscode.commands.registerCommand('azure.resource.selecttenants', async (node?: TreeNode) => {
		if (!(node instanceof AzureResourceAccountTreeNode) && !(node instanceof FlatAccountTreeNode)) {
			return;
		}

		const account = node.account;
		if (!account) {
			return;
		}

		const tenantFilterService = appContext.getService<IAzureResourceTenantFilterService>(AzureResourceServiceNames.tenantFilterService);

		let tenants = account.properties.tenants;

		let selectedTenants = await tenantFilterService.getSelectedTenants(account);
		if (!selectedTenants) {
			selectedTenants = [];
		}

		const selectedTenantIds: string[] = [];
		if (selectedTenants.length > 0) {
			selectedTenantIds.push(...selectedTenants.map((tenant) => tenant.id));
		} else {
			// ALL tenants are selected by default
			selectedTenantIds.push(...tenants.map((tenant) => tenant.id));
		}

		interface AzureResourceTenantQuickPickItem extends vscode.QuickPickItem {
			tenant: Tenant;
		}

		const tenantQuickPickItems: AzureResourceTenantQuickPickItem[] = tenants.map(tenant => {
			return {
				label: tenant.displayName,
				picked: selectedTenantIds.indexOf(tenant.id) !== -1,
				tenant: tenant
			};
		}).sort((a, b) => a.label.localeCompare(b.label));

		const selectedtenantQuickPickItems = await vscode.window.showQuickPick(tenantQuickPickItems, { canPickMany: true });
		if (selectedtenantQuickPickItems && selectedtenantQuickPickItems.length > 0) {
			for (const tree of trees) {
				await tree.refresh(undefined, false);
			}

			selectedTenants = selectedtenantQuickPickItems.map((item) => item.tenant);
			await tenantFilterService.saveSelectedTenants(account, selectedTenants);
		}
	});

	vscode.commands.registerCommand('azure.resource.refreshall', () => {
		for (const tree of trees) {
			tree.notifyNodeChanged(undefined);
		}
	});

	vscode.commands.registerCommand('azure.resource.azureview.refresh', async (node?: TreeNode) => {
		return azureViewTree.refresh(node, true);
	});

	vscode.commands.registerCommand('azure.resource.connectiondialog.refresh', async (node?: TreeNode) => {
		await connectionDialogTree.refresh(node, true); // clear cache first
		return connectionDialogTree.refresh(node, false);
	});

	vscode.commands.registerCommand('azure.resource.signin', async (node?: TreeNode) => {
		return vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
	});

	vscode.commands.registerCommand('azure.resource.connectsqlserver', async (node?: TreeNode | azdata.ObjectExplorerContext) => {
		if (!node) {
			return;
		}
		let connectionProfile: azdata.IConnectionProfile | undefined = undefined;
		if (node instanceof TreeNode) {
			const treeItem: azdata.TreeItem = await node.getTreeItem();
			if (!treeItem.payload) {
				return;
			}
			// Ensure connection is saved to the Connections list, then open connection dialog
			connectionProfile = Object.assign({}, treeItem.payload, { saveProfile: true });
		} else if (node.isConnectionNode) {
			connectionProfile = Object.assign({}, node.connectionProfile, { saveProfile: true });
		}

		const conn = await azdata.connection.openConnectionDialog(undefined, connectionProfile, { saveConnection: true, showDashboard: true });
		if (conn) {
			void vscode.commands.executeCommand('workbench.view.connections');
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
		await vscode.env.openExternal(vscode.Uri.parse(urlToOpen));
	});
}

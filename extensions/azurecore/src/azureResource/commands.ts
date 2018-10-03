/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { window, QuickPickItem } from 'vscode';
import { IConnectionProfile } from 'sqlops';
import { generateGuid } from './utils';
import { ApiWrapper } from '../apiWrapper';
import { TreeNode } from '../treeNodes';

import { AzureResourceTreeProvider } from './tree/treeProvider';
import { AzureResourceDatabaseServerTreeNode } from './tree/databaseServerTreeNode';
import { AzureResourceDatabaseTreeNode } from './tree/databaseTreeNode';
import { AzureResourceAccountTreeNode } from './tree/accountTreeNode';
import { AzureResourceServicePool } from './servicePool';
import { AzureResourceSubscription } from './models';

export function registerAzureResourceCommands(apiWrapper: ApiWrapper, tree: AzureResourceTreeProvider): void {
	apiWrapper.registerCommand('azureresource.selectsubscriptions', async (node?: TreeNode) => {
		if (!(node instanceof AzureResourceAccountTreeNode)) {
			return;
		}

		const accountNode = node as AzureResourceAccountTreeNode;

		const servicePool = AzureResourceServicePool.getInstance();

		let subscriptions = await accountNode.getCachedSubscriptions();
		if (!subscriptions || subscriptions.length === 0) {
			const credentials = await servicePool.credentialService.getCredentials(accountNode.account);
			subscriptions = await servicePool.subscriptionService.getSubscriptions(accountNode.account, credentials);
		}

		const selectedSubscriptions = (await servicePool.subscriptionFilterService.getSelectedSubscriptions(accountNode.account)) || <AzureResourceSubscription[]>[];
		const selectedSubscriptionIds: string[] = [];
		if (selectedSubscriptions.length > 0) {
			selectedSubscriptionIds.push(...selectedSubscriptions.map((subscription) => subscription.id));
		} else {
			// ALL subscriptions are selected by default
			selectedSubscriptionIds.push(...subscriptions.map((subscription) => subscription.id));
		}

		interface SubscriptionQuickPickItem extends QuickPickItem {
			subscription: AzureResourceSubscription;
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

	apiWrapper.registerCommand('azureresource.refreshall', () => tree.notifyNodeChanged(undefined));

	apiWrapper.registerCommand('azureresource.refresh', async (node?: TreeNode) => {
		tree.refresh(node, true);
	});

	apiWrapper.registerCommand('azureresource.connectsqldb', async (node?: TreeNode) => {
		let connectionProfile: IConnectionProfile = {
			id: generateGuid(),
			connectionName: undefined,
			serverName: undefined,
			databaseName: undefined,
			userName: undefined,
			password: '',
			authenticationType: undefined,
			savePassword: true,
			groupFullName: '',
			groupId: '',
			providerName: undefined,
			saveProfile: true,
			options: {
			}
		};

		if (node instanceof AzureResourceDatabaseServerTreeNode) {
			let databaseServer = node.databaseServer;
			connectionProfile.connectionName = `connection to '${databaseServer.defaultDatabaseName}' on '${databaseServer.fullName}'`;
			connectionProfile.serverName = databaseServer.fullName;
			connectionProfile.databaseName = databaseServer.defaultDatabaseName;
			connectionProfile.userName = databaseServer.loginName;
			connectionProfile.authenticationType = 'SqlLogin';
			connectionProfile.providerName = 'MSSQL';
		}

		if (node instanceof AzureResourceDatabaseTreeNode) {
			let database = node.database;
			connectionProfile.connectionName = `connection to '${database.name}' on '${database.serverFullName}'`;
			connectionProfile.serverName = database.serverFullName;
			connectionProfile.databaseName = database.name;
			connectionProfile.userName = database.loginName;
			connectionProfile.authenticationType = 'SqlLogin';
			connectionProfile.providerName = 'MSSQL';
		}

		const conn = await apiWrapper.openConnectionDialog(undefined, connectionProfile, { saveConnection: true, showDashboard: true });
		if (conn) {
			apiWrapper.executeCommand('workbench.view.connections');
		}
	});

	apiWrapper.registerCommand('azureresource.signin', async (node?: TreeNode) => {
		apiWrapper.executeCommand('sql.action.accounts.manageLinkedAccount');
	});
}

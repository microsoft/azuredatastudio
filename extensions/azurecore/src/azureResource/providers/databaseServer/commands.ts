/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IConnectionProfile } from 'sqlops';
import { AppContext } from '../../../appContext';

import { TreeNode } from '../../treeNode';
import { generateGuid } from '../../utils';
import { AzureResourceItemType } from '../../constants';
import { IAzureResourceDatabaseServerNode } from './interfaces';
import { AzureResourceResourceTreeNode } from '../../resourceTreeNode';

export function registerAzureResourceDatabaseServerCommands(appContext: AppContext): void {
	appContext.apiWrapper.registerCommand('azure.resource.connectsqlserver', async (node?: TreeNode) => {
		if (!node)
		{
			return;
		}

		const treeItem = await node.getTreeItem();
		if (treeItem.contextValue !== AzureResourceItemType.databaseServer) {
			return;
		}

		const resourceNode = (node as AzureResourceResourceTreeNode).resourceNodeWithProviderId.resourceNode;
		const databaseServer = (resourceNode as IAzureResourceDatabaseServerNode).databaseServer;

		let connectionProfile: IConnectionProfile = {
			id: generateGuid(),
			connectionName: undefined,
			serverName: databaseServer.fullName,
			databaseName: databaseServer.defaultDatabaseName,
			userName: databaseServer.loginName,
			password: '',
			authenticationType: 'SqlLogin',
			savePassword: true,
			groupFullName: '',
			groupId: '',
			providerName: 'MSSQL',
			saveProfile: true,
			options: {}
		};

		const conn = await appContext.apiWrapper.openConnectionDialog(undefined, connectionProfile, { saveConnection: true, showDashboard: true });
		if (conn) {
			appContext.apiWrapper.executeCommand('workbench.view.connections');
		}
	});
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IConnectionProfile } from 'sqlops';

import { TreeNode } from '../../treeNode';
import { AzureResourceServicePool } from '../../servicePool';
import { generateGuid } from '../../utils';
import { AzureResourceItemType } from '../../constants';
import { IAzureResourceDatabaseNode } from './interfaces';
import { AzureResourceResourceTreeNode } from '../../resourceTreeNode';

export function registerAzureResourceDatabaseCommands(): void {
	const servicePool = AzureResourceServicePool.getInstance();

	servicePool.apiWrapper.registerCommand('azure.resource.connectsqldb', async (node?: TreeNode) => {
		if (!node)
		{
			return;
		}

		const treeItem = await node.getTreeItem();
		if (treeItem.contextValue !== AzureResourceItemType.database) {
			return;
		}

		const resourceNode = (node as AzureResourceResourceTreeNode).resourceNodeWithProviderId.resourceNode;
		const database = (resourceNode as IAzureResourceDatabaseNode).database;

		let connectionProfile: IConnectionProfile = {
			id: generateGuid(),
			connectionName: `connection to '${database.name}' on '${database.serverFullName}'`,
			serverName: database.serverFullName,
			databaseName: database.name,
			userName: database.loginName,
			password: '',
			authenticationType: 'SqlLogin',
			savePassword: true,
			groupFullName: '',
			groupId: '',
			providerName: 'MSSQL',
			saveProfile: true,
			options: {
			}
		};

		const conn = await servicePool.apiWrapper.openConnectionDialog(undefined, connectionProfile, { saveConnection: true, showDashboard: true });
		if (conn) {
			servicePool.apiWrapper.executeCommand('workbench.view.connections');
		}
	});
}
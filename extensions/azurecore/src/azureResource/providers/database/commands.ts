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
import { IAzureResourceDatabaseNode } from './interfaces';
import { AzureResourceResourceTreeNode } from '../../resourceTreeNode';

export function registerAzureResourceDatabaseCommands(appContext: AppContext): void {
	appContext.apiWrapper.registerCommand('azure.resource.connectsqldb', async (node?: TreeNode) => {
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
			connectionName: undefined,
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
			options: {}
		};

		const conn = await appContext.apiWrapper.openConnectionDialog(undefined, connectionProfile, { saveConnection: true, showDashboard: true });
		if (conn) {
			appContext.apiWrapper.executeCommand('workbench.view.connections');
		}
	});
}
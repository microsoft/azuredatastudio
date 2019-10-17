/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IConnectionProfile } from 'azdata';
import { AppContext } from '../../../appContext';

import { TreeNode } from '../../treeNode';
import { generateGuid } from '../../utils';
import { AzureResourceItemType } from '../../constants';
import { IAzureResourceAzureDataExplorerNode } from './interfaces';
import { AzureResourceResourceTreeNode } from '../../resourceTreeNode';

export function registerAzureResourceAzureDataExplorerCommands(appContext: AppContext): void {
	appContext.apiWrapper.registerCommand('azure.resource.connectarcadiaworkspace', async (node?: TreeNode) => {
		if (!node) {
			return;
		}

		const treeItem = await node.getTreeItem();
		if (treeItem.contextValue !== AzureResourceItemType.databaseServer) {
			return;
		}

		const resourceNode = (node as AzureResourceResourceTreeNode).resourceNodeWithProviderId.resourceNode;
		const azureDataExplorer = (resourceNode as IAzureResourceAzureDataExplorerNode).azureDataExplorer;

		// TODO: Should the below be different for Azure Data Explorer
		let connectionProfile: IConnectionProfile = {
			id: generateGuid(),
			connectionName: undefined,
			serverName: azureDataExplorer.fullName,
			databaseName: azureDataExplorer.defaultDatabaseName,
			userName: azureDataExplorer.loginName,
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

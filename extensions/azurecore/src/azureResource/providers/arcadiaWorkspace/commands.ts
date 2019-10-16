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
import { IAzureResourceArcadiaWorkspaceNode } from './interfaces';
import { AzureResourceResourceTreeNode } from '../../resourceTreeNode';

export function registerAzureResourceArcadiaWorkspaceCommands(appContext: AppContext): void {
	appContext.apiWrapper.registerCommand('azure.resource.connectarcadiaworkspace', async (node?: TreeNode) => {
		if (!node) {
			return;
		}

		const treeItem = await node.getTreeItem();
		if (treeItem.contextValue !== AzureResourceItemType.databaseServer) {
			return;
		}

		const resourceNode = (node as AzureResourceResourceTreeNode).resourceNodeWithProviderId.resourceNode;
		const arcadiaWorkspace = (resourceNode as IAzureResourceArcadiaWorkspaceNode).arcadiaWorkspace;

		// TODO: Should the below be different for Arcadia Workspaces
		let connectionProfile: IConnectionProfile = {
			id: generateGuid(),
			connectionName: undefined,
			serverName: arcadiaWorkspace.fullName,
			databaseName: arcadiaWorkspace.defaultDatabaseName,
			userName: arcadiaWorkspace.loginName,
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionNodeType, TreeItem, Account } from 'azdata';
import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType } from '../../../azureResource/constants';
import { ApiWrapper } from '../../../apiWrapper';
import { generateGuid } from '../../utils';
import { IAzureResourceService } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { azureResource } from '../../azure-resource';

export class AzureResourceDatabaseServerTreeDataProvider extends ResourceTreeDataProviderBase<azureResource.AzureResourceDatabaseServer> {
	private static readonly containerId = 'azure.resource.providers.databaseServer.treeDataProvider.databaseServerContainer';
	private static readonly containerLabel = localize('azure.resource.providers.databaseServer.treeDataProvider.databaseServerContainerLabel', "SQL server");

	public constructor(
		databaseServerService: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		apiWrapper: ApiWrapper,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService, apiWrapper);
	}


	protected getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: Account): TreeItem {
		return {
			id: `databaseServer_${databaseServer.id ? databaseServer.id : databaseServer.name}`,
			label: databaseServer.name,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/sql_server_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/sql_server.svg')
			},
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServer,
			payload: {
				id: generateGuid(),
				connectionName: undefined,
				serverName: databaseServer.fullName,
				databaseName: databaseServer.defaultDatabaseName,
				userName: '',
				password: '',
				authenticationType: 'AzureMFA',
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: 'MSSQL',
				saveProfile: false,
				options: {},
				azureAccount: account.key.accountId
			},
			childProvider: 'MSSQL',
			type: ExtensionNodeType.Server
		};
	}

	protected createContainerNode(): azureResource.IAzureResourceNode {
		return {
			account: undefined,
			subscription: undefined,
			tenantId: undefined,
			treeItem: {
				id: AzureResourceDatabaseServerTreeDataProvider.containerId,
				label: AzureResourceDatabaseServerTreeDataProvider.containerLabel,
				iconPath: {
					dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
				},
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: AzureResourceItemType.databaseServerContainer
			}
		};
	}
}

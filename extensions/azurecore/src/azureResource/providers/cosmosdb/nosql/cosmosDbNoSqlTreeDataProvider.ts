/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, cosmosDBNoSqlProvider } from '../../../constants';
import { generateGuid } from '../../../utils';
import { DbServerGraphData, GraphData } from '../../../interfaces';
import { ResourceTreeDataProviderBase } from '../../resourceTreeDataProviderBase';
import { AzureAccountProperties, azureResource } from 'azurecore';
import * as azdata from 'azdata';

export class CosmosDbNoSqlTreeDataProvider extends ResourceTreeDataProviderBase<GraphData, DbServerGraphData> {
	private static readonly CONTAINER_ID = 'azure.resource.providers.databaseServer.treeDataProvider.cosmosDbNoSqlContainer';
	private static readonly CONTAINER_LABEL = localize('azure.resource.providers.databaseServer.treeDataProvider.cosmosDbNoSqlContainerLabel', "Azure CosmosDB for NoSQL");

	public constructor(
		databaseServerService: azureResource.IAzureResourceService,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}

	public getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: azdata.Account): azdata.TreeItem {
		return {
			id: `${AzureResourcePrefixes.cosmosdb}${account.key.accountId}${databaseServer.id ?? databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} (${CosmosDbNoSqlTreeDataProvider.CONTAINER_LABEL}, ${databaseServer.subscription.name})` : `${databaseServer.name}`,
			iconPath: this._extensionContext.asAbsolutePath('resources/cosmosDb.svg'),
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: AzureResourceItemType.cosmosDBNoSqlAccount,
			payload: {
				id: generateGuid(),
				connectionName: databaseServer.name,
				serverName: databaseServer.name,
				userName: databaseServer.loginName,
				password: '',
				authenticationType: azdata.connection.AuthenticationType.AzureMFA,
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: cosmosDBNoSqlProvider,
				saveProfile: false,
				options: {},
				azureAccount: account.key.accountId,
				azureTenantId: databaseServer.tenant,
				azureResourceId: databaseServer.id,
				azurePortalEndpoint: (account.properties as AzureAccountProperties).providerSettings.settings.portalEndpoint
			},
			childProvider: cosmosDBNoSqlProvider,
			type: azdata.ExtensionNodeType.Server
		};
	}

	public async getRootChild(): Promise<azdata.TreeItem> {
		return {
			id: CosmosDbNoSqlTreeDataProvider.CONTAINER_ID,
			label: CosmosDbNoSqlTreeDataProvider.CONTAINER_LABEL,
			iconPath: this._extensionContext.asAbsolutePath('resources/cosmosDb.svg'),
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServerContainer
		};
	}
}

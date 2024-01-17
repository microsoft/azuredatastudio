/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, pgsqlProvider } from '../../../constants';
import { AzureResourcePostgresDatabaseServer } from './cosmosDbPostgresService';
import { generateGuid } from '../../../utils';
import { DbServerGraphData, GraphData } from '../../../interfaces';
import { ResourceTreeDataProviderBase } from '../../resourceTreeDataProviderBase';
import { AzureAccountProperties, azureResource } from 'azurecore';
import * as azdata from 'azdata';

export class CosmosDbPostgresTreeDataProvider extends ResourceTreeDataProviderBase<GraphData, DbServerGraphData> {
	private static readonly CONTAINER_ID = 'azure.resource.providers.databaseServer.treeDataProvider.cosmosDbPostgresContainer';
	private static readonly CONTAINER_LABEL = localize('azure.resource.providers.databaseServer.treeDataProvider.cosmosDbPostgresContainerLabel', "Azure CosmosDB for PostgreSQL Cluster");

	public constructor(
		databaseServerService: azureResource.IAzureResourceService,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}

	public getTreeItemForResource(databaseServer: AzureResourcePostgresDatabaseServer, account: azdata.Account): azdata.TreeItem {
		return {
			id: `${AzureResourcePrefixes.cosmosdb}${account.key.accountId}${databaseServer.tenant}${databaseServer.id ?? databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} ${CosmosDbPostgresTreeDataProvider.CONTAINER_LABEL}, ${databaseServer.subscription.name})` : databaseServer.name,
			iconPath: this._extensionContext.asAbsolutePath('resources/cosmosDb.svg'),
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: AzureResourceItemType.cosmosDBPostgresAccount,
			payload: {
				id: generateGuid(),
				connectionName: databaseServer.name,
				serverName: databaseServer.fullName,
				userName: databaseServer.loginName,
				password: '',
				authenticationType: databaseServer.isServer ? azdata.connection.AuthenticationType.SqlLogin : azdata.connection.AuthenticationType.AzureMFA,
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: pgsqlProvider,
				saveProfile: false,
				options: {
					isServer: databaseServer.isServer,
				},
				azureAccount: account.key.accountId,
				azureTenantId: databaseServer.tenant,
				azureResourceId: databaseServer.id,
				azurePortalEndpoint: (account.properties as AzureAccountProperties).providerSettings.settings.portalEndpoint
			},
			childProvider: pgsqlProvider,
			type: azdata.ExtensionNodeType.Server
		};
	}

	public async getRootChild(): Promise<azdata.TreeItem> {
		return {
			id: CosmosDbPostgresTreeDataProvider.CONTAINER_ID,
			label: CosmosDbPostgresTreeDataProvider.CONTAINER_LABEL,
			iconPath: this._extensionContext.asAbsolutePath('resources/cosmosDb.svg'),
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServerContainer
		};
	}
}

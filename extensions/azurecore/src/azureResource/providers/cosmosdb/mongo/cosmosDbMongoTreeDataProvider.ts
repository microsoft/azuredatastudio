/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, cosmosDBMongoProvider } from '../../../constants';
import { AzureResourceMongoDatabaseServer } from './cosmosDbMongoService';
import { generateGuid } from '../../../utils';
import { DbServerGraphData, GraphData } from '../../../interfaces';
import { ResourceTreeDataProviderBase } from '../../resourceTreeDataProviderBase';
import { AzureAccountProperties, azureResource } from 'azurecore';
import * as azdata from 'azdata';

export class CosmosDbMongoTreeDataProvider extends ResourceTreeDataProviderBase<GraphData, DbServerGraphData> {
	private static readonly CONTAINER_ID = 'azure.resource.providers.databaseServer.treeDataProvider.cosmosDbMongoContainer';
	private static readonly CONTAINER_LABEL = localize('azure.resource.providers.databaseServer.treeDataProvider.cosmosDbMongoContainerLabel', "Azure CosmosDB for MongoDB");

	public constructor(
		databaseServerService: azureResource.IAzureResourceService,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}

	public getTreeItemForResource(databaseServer: AzureResourceMongoDatabaseServer, account: azdata.Account): azdata.TreeItem {
		return {
			id: `${AzureResourcePrefixes.cosmosdb}${account.key.accountId}${databaseServer.tenant}${databaseServer.id ?? databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} (${CosmosDbMongoTreeDataProvider.CONTAINER_LABEL}, ${databaseServer.subscription.name})` : `${databaseServer.name}`,
			iconPath: this._extensionContext.asAbsolutePath('resources/cosmosDb.svg'),
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: AzureResourceItemType.cosmosDBMongoAccount,
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
				providerName: cosmosDBMongoProvider,
				saveProfile: false,
				options: {
					isServer: databaseServer.isServer,
				},
				azureAccount: account.key.accountId,
				azureTenantId: databaseServer.tenant,
				azureResourceId: databaseServer.id,
				azurePortalEndpoint: (account.properties as AzureAccountProperties).providerSettings.settings.portalEndpoint
			},
			childProvider: cosmosDBMongoProvider,
			type: azdata.ExtensionNodeType.Server
		};
	}

	public async getRootChild(): Promise<azdata.TreeItem> {
		return {
			id: CosmosDbMongoTreeDataProvider.CONTAINER_ID,
			label: CosmosDbMongoTreeDataProvider.CONTAINER_LABEL,
			iconPath: this._extensionContext.asAbsolutePath('resources/cosmosDb.svg'),
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServerContainer
		};
	}
}

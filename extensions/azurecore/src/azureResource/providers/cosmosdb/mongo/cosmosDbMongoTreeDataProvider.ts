/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
// import * as nls from 'vscode-nls';
// const localize = nls.loadMessageBundle();

import { AzureResourceItemType } from '../../../constants';
import { generateGuid } from '../../../utils';
import { IAzureResourceService } from '../../../interfaces';
import { ResourceTreeDataProviderBase } from '../../resourceTreeDataProviderBase';
import { azureResource } from 'azureResource';
import * as azdata from 'azdata';

export class CosmosDbMongoTreeDataProvider extends ResourceTreeDataProviderBase<azureResource.AzureResourceDatabaseServer> {
	private static readonly containerId = 'azure.resource.providers.databaseServer.treeDataProvider.cosmosDbMongoContainer';
	private static readonly containerLabel = 'CosmosDB for Mongo'; // localize('azure.resource.providers.databaseServer.treeDataProvider.postgresServerContainerLabel', "Azure Database for PostgreSQL server");

	public constructor(
		databaseServerService: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}

	protected getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: azdata.Account): azdata.TreeItem {
		console.log(`getTreeItemForResource ${databaseServer.name}`);

		// TODO: How to pass these over to extension via payload?
		// const azureArmEndpoint = account.properties.providerSettings.settings.armResource.endpoint;
		// const subscriptionId = databaseServer.subscription.id;
		// const resourceGroup = databaseServer.resourceGroup;

		return {
			id: `Cosmosdb_${databaseServer.id ? databaseServer.id : databaseServer.name}`,
			label: databaseServer.name,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/sql_server_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/sql_server.svg')
			},
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: AzureResourceItemType.cosmosDBMongoAccount,
			payload: {
				id: generateGuid(),
				connectionName: databaseServer.name,
				serverName: databaseServer.name,
				userName: databaseServer.loginName,
				password: '',
				authenticationType: 'AzureMFA',
				savePassword: true,
				// groupFullName: 'CosmosDB Mongo',
				// groupId: 'cosmosdbmongo',
				providerName: 'COSMOSDB_MONGO',
				saveProfile: false,
				options: {},
				azureAccount: account.key.accountId,
				azureTenantId: databaseServer.tenant,
				azureResourceId: databaseServer.id,
				azurePortalEndpoint: account.properties.providerSettings.settings.portalEndpoint
			},
			childProvider: 'COSMOSDB_MONGO',
			type: azdata.ExtensionNodeType.Server
		};
	}

	protected createContainerNode(): azureResource.IAzureResourceNode {
		console.log(`createContainerNode`);
		return {
			account: undefined,
			subscription: undefined,
			tenantId: undefined,
			treeItem: {
				id: CosmosDbMongoTreeDataProvider.containerId,
				label: CosmosDbMongoTreeDataProvider.containerLabel,
				iconPath: {
					dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
				},
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				// contextValue: AzureResourceItemType.databaseServerContainer
			}
		};
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionNodeType, TreeItem, connection } from 'azdata';
import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, pgsqlProvider } from '../../constants';
import { generateGuid } from '../../utils';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';
import { GraphData, PostgresArcServerGraphData } from '../../interfaces';

export class PostgresServerArcTreeDataProvider extends ResourceTreeDataProviderBase<GraphData, PostgresArcServerGraphData> {
	private static readonly containerId = 'azure.resource.providers.postgresArcServer.treeDataProvider.postgresServerContainer';
	// allow-any-unicode-next-line
	private static readonly containerLabel = localize('azure.resource.providers.postgresArcServer.treeDataProvider.postgresServerContainerLabel', "PostgreSQL servers – Azure Arc");

	public constructor(
		databaseServerService: azureResource.IAzureResourceService,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}

	public getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: AzureAccount): TreeItem {
		return {
			id: `${AzureResourcePrefixes.postgresServerArc}${account.key.accountId}${databaseServer.tenant}${databaseServer.id ?? databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} (${PostgresServerArcTreeDataProvider.containerLabel}, ${databaseServer.subscription.name})` : databaseServer.name,
			iconPath: this._extensionContext.asAbsolutePath('resources/azureArcPostgresServer.svg'),
			collapsibleState: this.browseConnectionMode ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServer,
			payload: {
				id: generateGuid(),
				connectionName: undefined,
				serverName: databaseServer.fullName,
				databaseName: databaseServer.defaultDatabaseName,
				userName: `${databaseServer.loginName}@${databaseServer.fullName}`,
				password: '',
				authenticationType: connection.AuthenticationType.SqlLogin,
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: pgsqlProvider,
				saveProfile: false,
				options: {
					// Set default for SSL or will get error complaining about it not being set correctly
					'sslmode': 'require'
				},
				azureAccount: account.key.accountId,
				azureTenantId: databaseServer.tenant,
				azureResourceId: databaseServer.id,
				azurePortalEndpoint: account.properties.providerSettings.settings.portalEndpoint
			},
			childProvider: pgsqlProvider,
			type: ExtensionNodeType.Server
		};
	}

	public async getRootChild(): Promise<TreeItem> {
		return {
			id: PostgresServerArcTreeDataProvider.containerId,
			label: PostgresServerArcTreeDataProvider.containerLabel,
			iconPath: this._extensionContext.asAbsolutePath('resources/azureArcPostgresServer.svg'),
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServerContainer
		};
	}
}

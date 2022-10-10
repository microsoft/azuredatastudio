/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionNodeType, TreeItem, connection } from 'azdata';
import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType } from '../../constants';
import { generateGuid } from '../../utils';
import { IAzureResourceService } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

export class PostgresServerArcTreeDataProvider extends ResourceTreeDataProviderBase<azureResource.AzureResourceDatabaseServer> {
	private static readonly containerId = 'azure.resource.providers.postgresArcServer.treeDataProvider.postgresServerContainer';
	private static readonly containerLabel = localize('azure.resource.providers.postgresArcServer.treeDataProvider.postgresServerContainerLabel', "PostgreSQL Hyperscale – Azure Arc");

	public constructor(
		databaseServerService: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}


	protected getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: AzureAccount): TreeItem {
		return {
			id: `databaseServer_${databaseServer.id ? databaseServer.id : databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} (${PostgresServerArcTreeDataProvider.containerLabel}, ${databaseServer.subscription.name})` : databaseServer.name,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/sql_server_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/sql_server.svg')
			},
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
				providerName: 'PGSQL',
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
			childProvider: 'PGSQL',
			type: ExtensionNodeType.Server
		};
	}

	public async getRootChildren(): Promise<TreeItem[]> {
		return [{
			id: PostgresServerArcTreeDataProvider.containerId,
			label: PostgresServerArcTreeDataProvider.containerLabel,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
			},
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServerContainer
		}];
	}
}

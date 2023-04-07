/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType } from '../../constants';
import { generateGuid } from '../../utils';
import { IAzureResourceService } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccountProperties, azureResource } from 'azurecore';
import { Account, ExtensionNodeType, TreeItem, connection } from 'azdata';

export class MysqlFlexibleServerTreeDataProvider extends ResourceTreeDataProviderBase<azureResource.AzureResourceDatabaseServer> {
	private static readonly MYSQL_FLEXIBLE_SERVER_PROVIDER_ID = 'MySQL';
	private static readonly CONTAINER_ID = 'azure.resource.providers.databaseServer.treeDataProvider.mysqlFlexibleServerContainer';
	private static readonly CONTAINER_LABEL = localize('azure.resource.providers.databaseServer.treeDataProvider.mysqlFlexibleServerContainerLabel', "Azure Database for MySQL Flexible server");

	public constructor(
		databaseServerService: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}

	protected getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: Account): TreeItem {
		return {
			id: `databaseServer_${databaseServer.id ? databaseServer.id : databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} (${MysqlFlexibleServerTreeDataProvider.CONTAINER_LABEL}, ${databaseServer.subscription.name})` : databaseServer.name,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/mysql_server_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/mysql_server.svg')
			},
			collapsibleState: this.browseConnectionMode ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServer,
			payload: {
				id: generateGuid(),
				connectionName: undefined,
				serverName: databaseServer.fullName,
				databaseName: databaseServer.defaultDatabaseName,
				userName: databaseServer.loginName,
				password: '',
				authenticationType: connection.AuthenticationType.SqlLogin,
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: MysqlFlexibleServerTreeDataProvider.MYSQL_FLEXIBLE_SERVER_PROVIDER_ID,
				saveProfile: false,
				options: {
				},
				azureAccount: account.key.accountId,
				azureTenantId: databaseServer.tenant,
				azureResourceId: databaseServer.id,
				azurePortalEndpoint: (account.properties as AzureAccountProperties).providerSettings.settings.portalEndpoint
			},
			childProvider: MysqlFlexibleServerTreeDataProvider.MYSQL_FLEXIBLE_SERVER_PROVIDER_ID,
			type: ExtensionNodeType.Server
		};
	}

	public async getRootChildren(): Promise<TreeItem[]> {
		return [{
			id: MysqlFlexibleServerTreeDataProvider.CONTAINER_ID,
			label: MysqlFlexibleServerTreeDataProvider.CONTAINER_LABEL,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
			},
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServerContainer
		}];
	}
}

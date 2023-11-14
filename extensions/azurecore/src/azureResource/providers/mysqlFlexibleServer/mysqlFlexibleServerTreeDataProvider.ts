/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, mySqlProvider } from '../../constants';
import { generateGuid } from '../../utils';
import { DbServerGraphData, GraphData } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccountProperties, azureResource } from 'azurecore';
import { Account, ExtensionNodeType, TreeItem, connection } from 'azdata';

export class MysqlFlexibleServerTreeDataProvider extends ResourceTreeDataProviderBase<GraphData, DbServerGraphData> {
	private static readonly CONTAINER_ID = 'azure.resource.providers.databaseServer.treeDataProvider.mysqlFlexibleServerContainer';
	private static readonly CONTAINER_LABEL = localize('azure.resource.providers.databaseServer.treeDataProvider.mysqlFlexibleServerContainerLabel', "Azure Database for MySQL flexible servers");

	public constructor(
		databaseServerService: azureResource.IAzureResourceService,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}

	public getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: Account): TreeItem {
		return {
			id: `${AzureResourcePrefixes.mySqlFlexibleServer}${account.key.accountId}${databaseServer.tenant}${databaseServer.id ?? databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} (${MysqlFlexibleServerTreeDataProvider.CONTAINER_LABEL}, ${databaseServer.subscription.name})` : databaseServer.name,
			iconPath: this._extensionContext.asAbsolutePath('resources/mysqlDatabase.svg'),
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
				providerName: mySqlProvider,
				saveProfile: false,
				options: {
				},
				azureAccount: account.key.accountId,
				azureTenantId: databaseServer.tenant,
				azureResourceId: databaseServer.id,
				azurePortalEndpoint: (account.properties as AzureAccountProperties).providerSettings.settings.portalEndpoint
			},
			childProvider: mySqlProvider,
			type: ExtensionNodeType.Server
		};
	}

	public async getRootChild(): Promise<TreeItem> {
		return {
			id: MysqlFlexibleServerTreeDataProvider.CONTAINER_ID,
			label: MysqlFlexibleServerTreeDataProvider.CONTAINER_LABEL,
			iconPath: this._extensionContext.asAbsolutePath('resources/mysqlDatabase.svg'),
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServerContainer
		};
	}
}

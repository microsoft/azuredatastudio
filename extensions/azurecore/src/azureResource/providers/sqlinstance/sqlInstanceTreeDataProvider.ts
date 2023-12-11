/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionNodeType, TreeItem, connection } from 'azdata';
import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, mssqlProvider } from '../../constants';
import { generateGuid } from '../../utils';
import { GraphData, SqlInstanceGraphData } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

export class SqlInstanceTreeDataProvider extends ResourceTreeDataProviderBase<GraphData, SqlInstanceGraphData> {
	private static readonly containerId = 'azure.resource.providers.sqlInstanceContainer';
	private static readonly containerLabel = localize('azure.resource.providers.sqlInstanceContainerLabel', "SQL managed instances");

	public constructor(
		databaseServerService: azureResource.IAzureResourceService,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}

	public getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: AzureAccount): TreeItem {
		return {
			id: `${AzureResourcePrefixes.sqlInstance}${account.key.accountId}${databaseServer.tenant}${account.key.accountId}${databaseServer.id ?? databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} (${SqlInstanceTreeDataProvider.containerLabel}, ${databaseServer.subscription.name})` : databaseServer.name,
			iconPath: this._extensionContext.asAbsolutePath('resources/sqlManagedInstance.svg'),
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
				providerName: mssqlProvider,
				saveProfile: false,
				options: {},
				azureAccount: account.key.accountId,
				azureTenantId: databaseServer.tenant,
				azureResourceId: databaseServer.id,
				azurePortalEndpoint: account.properties.providerSettings.settings.portalEndpoint
			},
			childProvider: mssqlProvider,
			type: ExtensionNodeType.Server
		};
	}

	public async getRootChild(): Promise<TreeItem> {
		return {
			id: SqlInstanceTreeDataProvider.containerId,
			label: SqlInstanceTreeDataProvider.containerLabel,
			iconPath: this._extensionContext.asAbsolutePath('resources/sqlManagedInstance.svg'),
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServerContainer
		};
	}
}

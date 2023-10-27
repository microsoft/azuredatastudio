/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, ExtensionNodeType } from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, mssqlProvider } from '../../../azureResource/constants';
import { generateGuid } from '../../utils';
import { DatabaseGraphData, DbServerGraphData } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

export class AzureResourceDatabaseTreeDataProvider extends ResourceTreeDataProviderBase<DbServerGraphData, DatabaseGraphData> {

	private static readonly containerId = 'azure.resource.providers.database.treeDataProvider.databaseContainer';
	private static readonly containerLabel = localize('azure.resource.providers.database.treeDataProvider.databaseContainerLabel', "SQL databases");

	public constructor(
		databaseService: azureResource.IAzureResourceService,
		private _extensionContext: vscode.ExtensionContext
	) {
		super(databaseService);
	}

	public getTreeItemForResource(database: azureResource.AzureResourceDatabase, account: AzureAccount): TreeItem {
		return {
			id: `${AzureResourcePrefixes.database}${account.key.accountId}${database.tenant}${database.serverFullName}.${AzureResourcePrefixes.database}${database.id ?? database.name}`,
			label: this.browseConnectionMode ? `${database.serverName}/${database.name} (${AzureResourceDatabaseTreeDataProvider.containerLabel}, ${database.subscription.name})` : `${database.name} (${database.serverName})`,
			iconPath: this._extensionContext.asAbsolutePath('resources/sqlDatabase.svg'),
			collapsibleState: this.browseConnectionMode ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.database,
			payload: {
				id: generateGuid(),
				connectionName: undefined,
				serverName: database.serverFullName,
				databaseName: database.name,
				userName: database.loginName,
				password: '',
				authenticationType: '',
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: mssqlProvider,
				saveProfile: false,
				options: {},
				azureAccount: account.key.accountId,
				azureResourceId: database.id,
				azureTenantId: database.tenant,
				azurePortalEndpoint: account.properties.providerSettings.settings.portalEndpoint
			},
			childProvider: mssqlProvider,
			type: ExtensionNodeType.Database
		};
	}

	public async getRootChild(): Promise<TreeItem> {
		return {
			id: AzureResourceDatabaseTreeDataProvider.containerId,
			label: AzureResourceDatabaseTreeDataProvider.containerLabel,
			iconPath: this._extensionContext.asAbsolutePath('resources/sqlDatabase.svg'),
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseContainer
		};
	}
}

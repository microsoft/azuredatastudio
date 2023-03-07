/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, ExtensionNodeType } from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, mssqlProvider } from '../../../azureResource/constants';
import { generateGuid } from '../../utils';
import { IAzureResourceService } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

export class AzureResourceDatabaseTreeDataProvider extends ResourceTreeDataProviderBase<azureResource.AzureResourceDatabase> {

	private static readonly containerId = 'azure.resource.providers.database.treeDataProvider.databaseContainer';
	private static readonly containerLabel = localize('azure.resource.providers.database.treeDataProvider.databaseContainerLabel', "SQL database");

	public constructor(
		databaseService: IAzureResourceService<azureResource.AzureResourceDatabase>,
		private _extensionContext: vscode.ExtensionContext
	) {
		super(databaseService);
	}

	protected getTreeItemForResource(database: azureResource.AzureResourceDatabase, account: AzureAccount): TreeItem {
		return {
			id: `databaseServer_${database.serverFullName}.database_${database.name}`,
			label: this.browseConnectionMode ? `${database.serverName}/${database.name} (${AzureResourceDatabaseTreeDataProvider.containerLabel}, ${database.subscription.name})` : `${database.name} (${database.serverName})`,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/sql_database_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/sql_database.svg')
			},
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

	public async getRootChildren(): Promise<TreeItem[]> {
		return [{
			id: AzureResourceDatabaseTreeDataProvider.containerId,
			label: AzureResourceDatabaseTreeDataProvider.containerLabel,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
			},
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseContainer
		}];
	}
}

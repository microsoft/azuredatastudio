/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionNodeType, TreeItem } from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, mssqlProvider } from '../../../azureResource/constants';
import { generateGuid } from '../../utils';
import { DbServerGraphData, GraphData } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

export class AzureResourceDatabaseServerTreeDataProvider extends ResourceTreeDataProviderBase<GraphData, DbServerGraphData> {
	private static readonly containerId = 'azure.resource.providers.databaseServer.treeDataProvider.databaseServerContainer';
	private static readonly containerLabel = localize('azure.resource.providers.databaseServer.treeDataProvider.databaseServerContainerLabel', "SQL servers");

	public constructor(
		databaseServerService: azureResource.IAzureResourceService,
		private _extensionContext: vscode.ExtensionContext
	) {
		super(databaseServerService);
	}

	public getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: AzureAccount): TreeItem {
		return {
			id: `${AzureResourcePrefixes.databaseServer}${account.key.accountId}${databaseServer.tenant}${databaseServer.id ?? databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} (${AzureResourceDatabaseServerTreeDataProvider.containerLabel}, ${databaseServer.subscription.name})` : databaseServer.name,
			iconPath: this._extensionContext.asAbsolutePath('resources/sqlServer.svg'),
			collapsibleState: this.browseConnectionMode ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServer,
			payload: {
				id: generateGuid(),
				connectionName: undefined,
				serverName: databaseServer.fullName,
				databaseName: databaseServer.defaultDatabaseName,
				userName: databaseServer.loginName,
				password: '',
				authenticationType: '',
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
			id: AzureResourceDatabaseServerTreeDataProvider.containerId,
			label: AzureResourceDatabaseServerTreeDataProvider.containerLabel,
			iconPath: this._extensionContext.asAbsolutePath('resources/sqlServer.svg'),
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServerContainer
		};
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionNodeType, TreeItem, connection } from 'azdata';
import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, logAnalyticsProvider } from '../../constants';
import { generateGuid } from '../../utils';
import { AzureMonitorGraphData, GraphData } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

export class AzureMonitorTreeDataProvider extends ResourceTreeDataProviderBase<GraphData, AzureMonitorGraphData> {
	private static readonly containerId = 'azure.resource.providers.AzureMonitorContainer';
	private static readonly containerLabel = localize('azure.resource.providers.AzureMonitorContainerLabel', "Log Analytics workspaces");

	public constructor(
		databaseServerService: azureResource.IAzureResourceService,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}

	public getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: AzureAccount): TreeItem {
		return {
			id: `${AzureResourcePrefixes.logAnalytics}${account.key.accountId}${databaseServer.tenant}${databaseServer.id ? databaseServer.id : databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} (${AzureMonitorTreeDataProvider.containerLabel}, ${databaseServer.subscription.name})` : databaseServer.name,
			iconPath: this._extensionContext.asAbsolutePath('resources/logAnalyticsWorkspaces.svg'),
			collapsibleState: this.browseConnectionMode ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.azureMonitor,
			payload: {
				id: generateGuid(),
				connectionName: undefined,
				serverName: databaseServer.fullName,
				databaseName: databaseServer.defaultDatabaseName,
				userName: databaseServer.loginName,
				password: '',
				authenticationType: connection.AuthenticationType.AzureMFA,
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: logAnalyticsProvider,
				saveProfile: false,
				options: {},
				azureAccount: account.key.accountId,
				azureTenantId: databaseServer.tenant,
				azureResourceId: databaseServer.id,
				azurePortalEndpoint: account.properties.providerSettings.settings.portalEndpoint
			},
			childProvider: logAnalyticsProvider,
			type: ExtensionNodeType.Server
		};
	}

	public async getRootChild(): Promise<TreeItem> {
		return {
			id: AzureMonitorTreeDataProvider.containerId,
			label: AzureMonitorTreeDataProvider.containerLabel,
			iconPath: this._extensionContext.asAbsolutePath('resources/logAnalyticsWorkspaces.svg'),
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.databaseServerContainer
		};
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionNodeType, TreeItem, Account } from 'azdata';
import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType } from '../../constants';
import { generateGuid } from '../../utils';
import { IAzureResourceService } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { azureResource } from 'azureResource';

export class AzureMonitorTreeDataProvider extends ResourceTreeDataProviderBase<azureResource.AzureResourceDatabaseServer> {
	private static readonly containerId = 'azure.resource.providers.AzureMonitorContainer';
	private static readonly containerLabel = localize('azure.resource.providers.AzureMonitorContainerLabel', "Log Analytics workspace");

	public constructor(
		databaseServerService: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		private _extensionContext: ExtensionContext
	) {
		super(databaseServerService);
	}


	protected getTreeItemForResource(databaseServer: azureResource.AzureResourceDatabaseServer, account: Account): TreeItem {
		return {
			id: `LogAnalytics_${databaseServer.id ? databaseServer.id : databaseServer.name}`,
			label: this.browseConnectionMode ? `${databaseServer.name} (${AzureMonitorTreeDataProvider.containerLabel}, ${databaseServer.subscription.name})` : databaseServer.name,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/azure_monitor_dark.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/azure_monitor_light.svg')
			},
			collapsibleState: this.browseConnectionMode ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.azureMonitor,
			payload: {
				id: generateGuid(),
				connectionName: undefined,
				serverName: databaseServer.fullName,
				databaseName: databaseServer.defaultDatabaseName,
				userName: databaseServer.loginName,
				password: '',
				authenticationType: 'AzureMFA',
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: 'LOGANALYTICS',
				saveProfile: false,
				options: {},
				azureAccount: account.key.accountId,
				azureTenantId: databaseServer.tenant,
				azureResourceId: databaseServer.id,
				azurePortalEndpoint: account.properties.providerSettings.settings.portalEndpoint
			},
			childProvider: 'LOGANALYTICS',
			type: ExtensionNodeType.Server
		};
	}

	protected createContainerNode(): azureResource.IAzureResourceNode {
		return {
			account: undefined,
			subscription: undefined,
			tenantId: undefined,
			treeItem: {
				id: AzureMonitorTreeDataProvider.containerId,
				label: AzureMonitorTreeDataProvider.containerLabel,
				iconPath: {
					dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
				},
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: AzureResourceItemType.databaseServerContainer
			}
		};
	}
}

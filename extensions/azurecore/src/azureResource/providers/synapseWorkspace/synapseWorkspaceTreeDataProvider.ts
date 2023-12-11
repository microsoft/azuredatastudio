/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionNodeType, TreeItem } from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, mssqlProvider } from '../../constants';
import { generateGuid } from '../../utils';
import { GraphData, SynapseWorkspaceGraphData } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

export class AzureResourceSynapseWorkspaceTreeDataProvider extends ResourceTreeDataProviderBase<GraphData, SynapseWorkspaceGraphData> {
	private static readonly containerId = 'azure.resource.providers.synapseWorkspace.treeDataProvider.synapseWorkspaceContainer';
	private static readonly containerLabel = localize('azure.resource.providers.synapseWorkspace.treeDataProvider.synapseWorkspaceContainerLabel', "Azure Synapse Analytics");

	public constructor(
		synapseWorkspaceService: azureResource.IAzureResourceService,
		private _extensionContext: vscode.ExtensionContext
	) {
		super(synapseWorkspaceService);
	}

	public getTreeItemForResource(synapseWorkspace: azureResource.AzureResourceDatabaseServer, account: AzureAccount): TreeItem {
		return {
			id: `${AzureResourcePrefixes.synapseWorkspace}${account.key.accountId}${synapseWorkspace.tenant}${synapseWorkspace.id ?? synapseWorkspace.name}`,
			label: this.browseConnectionMode ? `${synapseWorkspace.name} (${AzureResourceSynapseWorkspaceTreeDataProvider.containerLabel}, ${synapseWorkspace.subscription.name})` : synapseWorkspace.name,
			iconPath: this._extensionContext.asAbsolutePath('resources/azureSynapseAnalytics.svg'),
			collapsibleState: this.browseConnectionMode ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.synapseWorkspace,
			payload: {
				id: generateGuid(),
				connectionName: undefined,
				serverName: synapseWorkspace.fullName,
				databaseName: synapseWorkspace.defaultDatabaseName,
				userName: synapseWorkspace.loginName,
				password: '',
				authenticationType: '',
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: mssqlProvider,
				saveProfile: false,
				options: {},
				azureAccount: account.key.accountId,
				azureTenantId: synapseWorkspace.tenant,
				azureResourceId: synapseWorkspace.id,
				azurePortalEndpoint: account.properties.providerSettings.settings.portalEndpoint
			},
			childProvider: mssqlProvider,
			type: ExtensionNodeType.Server
		};
	}

	public async getRootChild(): Promise<TreeItem> {
		return {
			id: AzureResourceSynapseWorkspaceTreeDataProvider.containerId,
			label: AzureResourceSynapseWorkspaceTreeDataProvider.containerLabel,
			iconPath: this._extensionContext.asAbsolutePath('resources/azureSynapseAnalytics.svg'),
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.synapseWorkspaceContainer
		};
	}
}

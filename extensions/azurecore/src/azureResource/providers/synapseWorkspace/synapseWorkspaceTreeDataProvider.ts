/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionNodeType, TreeItem } from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, mssqlProvider } from '../../constants';
import { generateGuid } from '../../utils';
import { IAzureResourceService } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

export class AzureResourceSynapseWorkspaceTreeDataProvider extends ResourceTreeDataProviderBase<azureResource.AzureResourceDatabaseServer> {
	private static readonly containerId = 'azure.resource.providers.synapseWorkspace.treeDataProvider.synapseWorkspaceContainer';
	private static readonly containerLabel = localize('azure.resource.providers.synapseWorkspace.treeDataProvider.synapseWorkspaceContainerLabel', "Azure Synapse Analytics");

	public constructor(
		synapseWorkspaceService: IAzureResourceService<azureResource.AzureResourceDatabaseServer>,
		private _extensionContext: vscode.ExtensionContext
	) {
		super(synapseWorkspaceService);
	}

	protected getTreeItemForResource(synapseWorkspace: azureResource.AzureResourceDatabaseServer, account: AzureAccount): TreeItem {
		return {
			id: `synapseWorkspace_${synapseWorkspace.id ?? synapseWorkspace.name}`,
			label: this.browseConnectionMode ? `${synapseWorkspace.name} (${AzureResourceSynapseWorkspaceTreeDataProvider.containerLabel}, ${synapseWorkspace.subscription.name})` : synapseWorkspace.name,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/sql_server_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/sql_server.svg')
			},
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

	public async getRootChildren(): Promise<TreeItem[]> {
		return [{
			id: AzureResourceSynapseWorkspaceTreeDataProvider.containerId,
			label: AzureResourceSynapseWorkspaceTreeDataProvider.containerLabel,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
			},
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.synapseWorkspaceContainer
		}];
	}
}

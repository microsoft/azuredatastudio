/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, ExtensionNodeType } from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, AzureResourcePrefixes, mssqlProvider } from '../../constants';
import { generateGuid } from '../../utils';
import { SynapseGraphData, SynapseWorkspaceGraphData } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

export class AzureResourceSynapseSqlPoolTreeDataProvider extends ResourceTreeDataProviderBase<SynapseWorkspaceGraphData, SynapseGraphData> {

	private static readonly containerId = 'azure.resource.providers.synapseSqlPool.treeDataProvider.synapseSqlPoolContainer';
	private static readonly containerLabel = localize('azure.resource.providers.synapseSqlPool.treeDataProvider.synapseSqlPoolContainerLabel', "Dedicated SQL Pools");

	public constructor(
		synapseSqlPoolService: azureResource.IAzureResourceService,
		private _extensionContext: vscode.ExtensionContext
	) {
		super(synapseSqlPoolService);
	}

	public getTreeItemForResource(synapse: azureResource.AzureResourceDatabase, account: AzureAccount): TreeItem {
		return {
			id: `${AzureResourcePrefixes.synapseWorkspace}${account.key.accountId}${synapse.tenant}${synapse.serverFullName}.${AzureResourcePrefixes.synapseSqlPool}${synapse.id ?? synapse.name}`,
			label: this.browseConnectionMode ? `${synapse.serverName}/${synapse.name} (${AzureResourceSynapseSqlPoolTreeDataProvider.containerLabel}, ${synapse.subscription.name})` : `${synapse.name} (${synapse.serverName})`,
			iconPath: this._extensionContext.asAbsolutePath('resources/sqlPools.svg'),
			collapsibleState: this.browseConnectionMode ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.synapseSqlPool,
			payload: {
				id: generateGuid(),
				connectionName: undefined,
				serverName: synapse.serverFullName,
				databaseName: synapse.name,
				userName: synapse.loginName,
				password: '',
				authenticationType: '',
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: mssqlProvider,
				saveProfile: false,
				options: {},
				azureAccount: account.key.accountId,
				azureResourceId: synapse.id,
				azureTenantId: synapse.tenant,
				azurePortalEndpoint: account.properties.providerSettings.settings.portalEndpoint
			},
			childProvider: mssqlProvider,
			type: ExtensionNodeType.Database
		};
	}

	public async getRootChild(): Promise<TreeItem> {
		return {
			id: AzureResourceSynapseSqlPoolTreeDataProvider.containerId,
			label: AzureResourceSynapseSqlPoolTreeDataProvider.containerLabel,
			iconPath: this._extensionContext.asAbsolutePath('resources/sqlPools.svg'),
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.synapseSqlPoolContainer
		};
	}
}

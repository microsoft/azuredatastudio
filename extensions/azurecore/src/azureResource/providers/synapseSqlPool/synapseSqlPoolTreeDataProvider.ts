/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, ExtensionNodeType } from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { AzureResourceItemType, mssqlProvider } from '../../constants';
import { generateGuid } from '../../utils';
import { IAzureResourceService } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';

export class AzureResourceSynapseSqlPoolTreeDataProvider extends ResourceTreeDataProviderBase<azureResource.AzureResourceDatabase> {

	private static readonly containerId = 'azure.resource.providers.synapseSqlPool.treeDataProvider.synapseSqlPoolContainer';
	private static readonly containerLabel = localize('azure.resource.providers.synapseSqlPool.treeDataProvider.synapseSqlPoolContainerLabel', "Dedicated SQL Pools");

	public constructor(
		synapseSqlPoolService: IAzureResourceService<azureResource.AzureResourceDatabase>,
		private _extensionContext: vscode.ExtensionContext
	) {
		super(synapseSqlPoolService);
	}

	protected getTreeItemForResource(synapse: azureResource.AzureResourceDatabase, account: AzureAccount): TreeItem {
		return {
			id: `synapseWorkspace_${synapse.serverFullName}.synapseSqlPool_${synapse.name}`,
			label: this.browseConnectionMode ? `${synapse.serverName}/${synapse.name} (${AzureResourceSynapseSqlPoolTreeDataProvider.containerLabel}, ${synapse.subscription.name})` : `${synapse.name} (${synapse.serverName})`,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/sql_database_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/sql_database.svg')
			},
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

	public async getRootChildren(): Promise<TreeItem[]> {
		return [{
			id: AzureResourceSynapseSqlPoolTreeDataProvider.containerId,
			label: AzureResourceSynapseSqlPoolTreeDataProvider.containerLabel,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
			},
			collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.synapseSqlPoolContainer
		}];
	}
}

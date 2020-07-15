/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, ExtensionNodeType, Account } from 'azdata';
import { TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { azureResource } from '../../azure-resource';
import { AzureResourceItemType } from '../../../azureResource/constants';
import { generateGuid } from '../../utils';
import { IAzureResourceService } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';

export class AzureResourceDatabaseTreeDataProvider extends ResourceTreeDataProviderBase<azureResource.AzureResourceDatabase> {

	private static readonly containerId = 'azure.resource.providers.database.treeDataProvider.databaseContainer';
	private static readonly containerLabel = localize('azure.resource.providers.database.treeDataProvider.databaseContainerLabel', "SQL database");

	public constructor(
		databaseService: IAzureResourceService<azureResource.AzureResourceDatabase>,
		private _extensionContext: ExtensionContext
	) {
		super(databaseService);
	}
	protected getTreeItemForResource(database: azureResource.AzureResourceDatabase, account: Account): TreeItem {
		return {
			id: `databaseServer_${database.serverFullName}.database_${database.name}`,
			label: `${database.name} (${database.serverName})`,
			iconPath: {
				dark: this._extensionContext.asAbsolutePath('resources/dark/sql_database_inverse.svg'),
				light: this._extensionContext.asAbsolutePath('resources/light/sql_database.svg')
			},
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: AzureResourceItemType.database,
			payload: {
				id: generateGuid(),
				connectionName: undefined,
				serverName: database.serverFullName,
				databaseName: database.name,
				userName: database.loginName,
				password: '',
				authenticationType: 'SqlLogin',
				savePassword: true,
				groupFullName: '',
				groupId: '',
				providerName: 'MSSQL',
				saveProfile: false,
				options: {},
				azureAccount: account.key.accountId,
				azureResourceId: database.id,
				azureTenantId: database.tenant,
				azurePortalEndpoint: account.properties.providerSettings.settings.portalEndpoint
			},
			childProvider: 'MSSQL',
			type: ExtensionNodeType.Database
		};
	}

	protected createContainerNode(): azureResource.IAzureResourceNode {
		return {
			account: undefined,
			subscription: undefined,
			tenantId: undefined,
			treeItem: {
				id: AzureResourceDatabaseTreeDataProvider.containerId,
				label: AzureResourceDatabaseTreeDataProvider.containerLabel,
				iconPath: {
					dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
				},
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: AzureResourceItemType.databaseContainer
			}
		};
	}
}

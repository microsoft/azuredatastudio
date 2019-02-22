/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { AzureResource } from 'sqlops';
import { TreeItem, TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import { TokenCredentials } from 'ms-rest';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { azureResource } from '../../azure-resource';
import { IAzureResourceDatabaseService, IAzureResourceDatabaseNode } from './interfaces';
import { AzureResourceDatabase } from './models';
import { AzureResourceItemType } from '../../../azureResource/constants';
import { ApiWrapper } from '../../../apiWrapper';
import { generateGuid } from '../../utils';

export class AzureResourceDatabaseTreeDataProvider implements azureResource.IAzureResourceTreeDataProvider {
	public constructor(
		databaseService: IAzureResourceDatabaseService,
		apiWrapper: ApiWrapper,
		extensionContext: ExtensionContext
	) {
		this._databaseService = databaseService;
		this._apiWrapper = apiWrapper;
		this._extensionContext = extensionContext;
	}

	public getTreeItem(element: azureResource.IAzureResourceNode): TreeItem | Thenable<TreeItem> {
		return element.treeItem;
	}

	public async getChildren(element?: azureResource.IAzureResourceNode): Promise<azureResource.IAzureResourceNode[]> {
		if (!element) {
			return [this.createContainerNode()];
		}

		const tokens = await this._apiWrapper.getSecurityToken(element.account, AzureResource.ResourceManagement);
		const credential = new TokenCredentials(tokens[element.tenantId].token, tokens[element.tenantId].tokenType);

		const databases: AzureResourceDatabase[] = (await this._databaseService.getDatabases(element.subscription, credential)) || <AzureResourceDatabase[]>[];

		return databases.map((database) => <IAzureResourceDatabaseNode>{
			account: element.account,
			subscription: element.subscription,
			tenantId: element.tenantId,
			database: database,
			treeItem: {
				id: `databaseServer_${database.serverFullName}.database_${database.name}`,
				label: `${database.name} (${database.serverName})`,
				iconPath: {
					dark: this._extensionContext.asAbsolutePath('resources/dark/sql_database_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/sql_database.svg')
				},
				collapsibleState: process.env.NODE_ENV === 'development' ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
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
					options: {}
				},
				childProvider: 'MSSQL'
			}
		});
	}

	private createContainerNode(): azureResource.IAzureResourceNode {
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

	private _databaseService: IAzureResourceDatabaseService = undefined;
	private _apiWrapper: ApiWrapper = undefined;
	private _extensionContext: ExtensionContext = undefined;

	private static readonly containerId = 'azure.resource.providers.database.treeDataProvider.databaseContainer';
	private static readonly containerLabel = localize('azure.resource.providers.database.treeDataProvider.databaseContainerLabel', 'SQL Databases');
}
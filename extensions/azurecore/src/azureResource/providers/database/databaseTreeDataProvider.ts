/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { azureResource, AzureResource } from 'sqlops';
import { TreeItem, TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import { TokenCredentials } from 'ms-rest';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { IAzureResourceDatabaseService, IAzureResourceDatabaseNode } from './interfaces';
import { AzureResourceDatabase } from './models';
import { AzureResourceItemType } from '../../../azureResource/constants';
import { ApiWrapper } from '../../../apiWrapper';

export class AzureResourceDatabaseTreeDataProvider implements azureResource.IAzureResourceTreeDataProvider {
	public constructor(
		public databaseService: IAzureResourceDatabaseService,
		public apiWrapper: ApiWrapper,
		public extensionContext: ExtensionContext
	) {
	}

	public getTreeItem(element: azureResource.IAzureResourceNode): TreeItem | Thenable<TreeItem> {
		return element.treeItem;
	}

	public async getChildren(element?: azureResource.IAzureResourceNode): Promise<azureResource.IAzureResourceNode[]> {
		if (!element) {
			return [this.createContainerNode()];
		}

		const tokens = await this.apiWrapper.getSecurityToken(element.account, AzureResource.ResourceManagement);
		const credential = new TokenCredentials(tokens[element.tenantId].token, tokens[element.tenantId].tokenType);

		const databases: AzureResourceDatabase[] = (await this.databaseService.getDatabases(element.subscription, credential)) || <AzureResourceDatabase[]>[];

		return databases.map((database) => <IAzureResourceDatabaseNode>{
			id: `database_${database.name}`,
			account: element.account,
			subscription: element.subscription,
			tenantId: element.tenantId,
			database: database,
			treeItem: {
				id: `database_${database.name}`,
				label: `${database.name} (${database.serverName})`,
				iconPath: {
					dark: this.extensionContext.asAbsolutePath('resources/dark/sql_database_inverse.svg'),
					light: this.extensionContext.asAbsolutePath('resources/light/sql_database.svg')
				},
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: AzureResourceItemType.database
			}
		});
	}

	private createContainerNode(): azureResource.IAzureResourceNode {
		return {
			id: AzureResourceDatabaseTreeDataProvider.containerId,
			account: undefined,
			subscription: undefined,
			tenantId: undefined,
			treeItem: {
				id: AzureResourceDatabaseTreeDataProvider.containerId,
				label: AzureResourceDatabaseTreeDataProvider.containerLabel,
				iconPath: {
					dark: this.extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
					light: this.extensionContext.asAbsolutePath('resources/light/folder.svg')
				},
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: AzureResourceItemType.databaseContainer
			}
		}
	}

	private static readonly idPrefix = 'azure.resource.providers.database.treeDataProvider';

	private static readonly containerId = `${AzureResourceDatabaseTreeDataProvider.idPrefix}.databaseContainer`;
	private static readonly containerLabel = localize(`${AzureResourceDatabaseTreeDataProvider.idPrefix}.databaseContainerLabel`, 'SQL Databases');
}
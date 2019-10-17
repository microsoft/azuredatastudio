/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { AzureResource, ExtensionNodeType } from 'azdata';
import { TreeItem, TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import { TokenCredentials } from 'ms-rest';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { azureResource } from '../../azure-resource';
import { IAzureResourceAzureDataExplorerService, IAzureResourceAzureDataExplorerNode } from './interfaces';
import { AzureResourceAzureDataExplorer } from './models';
import { AzureResourceItemType } from '../../constants';
import { ApiWrapper } from '../../../apiWrapper';
import { generateGuid } from '../../utils';

export class AzureResourceAzureDataExplorerTreeDataProvider implements azureResource.IAzureResourceTreeDataProvider {
	public constructor(
		azureDataExplorerService: IAzureResourceAzureDataExplorerService,
		apiWrapper: ApiWrapper,
		extensionContext: ExtensionContext
	) {
		this._azureDataExplorerService = azureDataExplorerService;
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

		const azureDataExplorers: AzureResourceAzureDataExplorer[] = (await this._azureDataExplorerService.getAzureDataExplorers(element.subscription, credential)) || <AzureResourceAzureDataExplorer[]>[];

		return azureDataExplorers.map((azureDataExplorer) => <IAzureResourceAzureDataExplorerNode>{
			account: element.account,
			subscription: element.subscription,
			tenantId: element.tenantId,
			azureDataExplorer: azureDataExplorer,
			treeItem: {
				id: `azureDataExplorer_${azureDataExplorer.name}`,
				label: azureDataExplorer.name,
				iconPath: {
					// TODO: Need new icons for Arcadia workspaces.
					dark: this._extensionContext.asAbsolutePath('resources/dark/sql_server_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/sql_server.svg')
				},
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: AzureResourceItemType.azureDataExplorer,
				payload: { // TODO: What is the payload for Arcadia
					id: generateGuid(),
					connectionName: undefined,
					serverName: azureDataExplorer.name,
					databaseName: '',
					userName: '',
					password: '',
					authenticationType: 'AzureMFA',
					savePassword: true,
					groupFullName: '',
					groupId: '',
					providerName: 'MSSQL',
					saveProfile: false,
					options: {}
				},
				childProvider: 'MSSQL',
				type: ExtensionNodeType.Server // TODO: Should we change azdata enum to include Arcadia workspaces?
			}
		});
	}

	private createContainerNode(): azureResource.IAzureResourceNode {
		return {
			account: undefined,
			subscription: undefined,
			tenantId: undefined,
			treeItem: {
				id: AzureResourceAzureDataExplorerTreeDataProvider.containerId,
				label: AzureResourceAzureDataExplorerTreeDataProvider.containerLabel,
				iconPath: {
					dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
				},
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: AzureResourceItemType.azureDataExplorerContainer
			}
		};
	}

	private _azureDataExplorerService: IAzureResourceAzureDataExplorerService = undefined;
	private _apiWrapper: ApiWrapper = undefined;
	private _extensionContext: ExtensionContext = undefined;

	private static readonly containerId = 'azure.resource.providers.azureDataExplorer.treeDataProvider.azureDataExplorerContainer';
	private static readonly containerLabel = localize('azure.resource.providers.azureDataExplorer.treeDataProvider.azureDataExplorerContainerLabel', 'Azure Data Explorer clusters');
}

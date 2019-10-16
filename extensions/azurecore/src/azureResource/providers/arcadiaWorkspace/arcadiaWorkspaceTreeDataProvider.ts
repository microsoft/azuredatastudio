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
import { IAzureResourceArcadiaWorkspaceService, IAzureResourceArcadiaWorkspaceNode } from './interfaces';
import { AzureResourceArcadiaWorkspace } from './models';
import { AzureResourceItemType } from '../../constants';
import { ApiWrapper } from '../../../apiWrapper';
import { generateGuid } from '../../utils';

export class AzureResourceArcadiaWorkspaceTreeDataProvider implements azureResource.IAzureResourceTreeDataProvider {
	public constructor(
		arcadiaWorkspaceService: IAzureResourceArcadiaWorkspaceService,
		apiWrapper: ApiWrapper,
		extensionContext: ExtensionContext
	) {
		this._arcadiaWorkspaceService = arcadiaWorkspaceService;
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

		const arcadiaWorkspaces: AzureResourceArcadiaWorkspace[] = (await this._arcadiaWorkspaceService.getArcadiaWorkspaces(element.subscription, credential)) || <AzureResourceArcadiaWorkspace[]>[];

		return arcadiaWorkspaces.map((arcadiaWorkspace) => <IAzureResourceArcadiaWorkspaceNode>{
			account: element.account,
			subscription: element.subscription,
			tenantId: element.tenantId,
			arcadiaWorkspace: arcadiaWorkspace,
			treeItem: {
				id: `arcadiaWorkspace_${arcadiaWorkspace.name}`,
				label: arcadiaWorkspace.name,
				iconPath: {
					// TODO: Need new icons for Arcadia workspaces.
					dark: this._extensionContext.asAbsolutePath('resources/dark/sql_server_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/sql_server.svg')
				},
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: AzureResourceItemType.arcadiaWorkspace,
				payload: {
					id: generateGuid(),
					connectionName: undefined,
					serverName: arcadiaWorkspace.fullName,
					databaseName: arcadiaWorkspace.defaultDatabaseName,
					userName: arcadiaWorkspace.loginName,
					password: '',
					authenticationType: 'SqlLogin',
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
				id: AzureResourceArcadiaWorkspaceTreeDataProvider.containerId,
				label: AzureResourceArcadiaWorkspaceTreeDataProvider.containerLabel,
				iconPath: {
					dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
				},
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: AzureResourceItemType.arcadiaWorkspaceContainer
			}
		};
	}

	private _arcadiaWorkspaceService: IAzureResourceArcadiaWorkspaceService = undefined;
	private _apiWrapper: ApiWrapper = undefined;
	private _extensionContext: ExtensionContext = undefined;

	private static readonly containerId = 'azure.resource.providers.arcadiaWorkspace.treeDataProvider.arcadiaWorkspaceContainer';
	private static readonly containerLabel = localize('azure.resource.providers.arcadiaWorkspace.treeDataProvider.arcadiaWorkspaceContainerLabel', 'Arcadia Workspaces');
}

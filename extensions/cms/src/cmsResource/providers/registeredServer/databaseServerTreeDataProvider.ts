/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeItem, TreeItemCollapsibleState, ExtensionContext } from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { cmsResource } from '../../cms-resource';
import { ICmsResourceRegisteredServerService, ICmsResourceRegisteredServerNode } from './interfaces';
import { CmsResourceRegisteredServer } from './models';
import { AzureResourceItemType } from '../../../cmsResource/constants';
import { ApiWrapper } from '../../../apiWrapper';

export class CmsRegisteredServerTreeDataProvider implements cmsResource.ICmsResourceTreeDataProvider {
	public constructor(
		databaseServerService: ICmsResourceRegisteredServerService,
		apiWrapper: ApiWrapper,
		extensionContext: ExtensionContext
	) {
		this._databaseServerService = databaseServerService;
		this._apiWrapper = apiWrapper;
		this._extensionContext = extensionContext;
	}

	public getTreeItem(element: cmsResource.ICmsResourceNode): TreeItem | Thenable<TreeItem> {
		return element.treeItem;
	}

	public async getChildren(element?: cmsResource.ICmsResourceNode): Promise<cmsResource.ICmsResourceNode[]> {
		if (!element) {
			return [this.createContainerNode()];
		}

		const registeredServers: CmsResourceRegisteredServer[] = (await this._databaseServerService.getDatabaseServers()) || <CmsResourceRegisteredServer[]>[];

		return registeredServers.map((registeredServer) => <ICmsResourceRegisteredServerNode>{
			registeredServer: registeredServer,
			treeItem: {
				id: `registeredServer_${registeredServer.name}`,
				label: registeredServer.name,
				iconPath: {
					dark: this._extensionContext.asAbsolutePath('resources/dark/sql_server_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/sql_server.svg')
				},
				collapsibleState: TreeItemCollapsibleState.None,
				contextValue: AzureResourceItemType.databaseServer
			}
		});
	}

	private createContainerNode(): cmsResource.ICmsResourceNode {
		return {
			treeItem: {
				id: CmsRegisteredServerTreeDataProvider.containerId,
				label: CmsRegisteredServerTreeDataProvider.containerLabel,
				iconPath: {
					dark: this._extensionContext.asAbsolutePath('resources/dark/folder_inverse.svg'),
					light: this._extensionContext.asAbsolutePath('resources/light/folder.svg')
				},
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				contextValue: AzureResourceItemType.databaseServerContainer
			}
		};
	}

	private _databaseServerService: ICmsResourceRegisteredServerService = undefined;
	private _apiWrapper: ApiWrapper = undefined;
	private _extensionContext: ExtensionContext = undefined;

	private static readonly containerId = 'cms.resource.providers.registeredServer.treeDataProvider.registeredServerContainer';
	private static readonly containerLabel = localize('cms.resource.providers.registeredServer.treeDataProvider.registeredServerContainerLabel', 'Registered Servers');
}
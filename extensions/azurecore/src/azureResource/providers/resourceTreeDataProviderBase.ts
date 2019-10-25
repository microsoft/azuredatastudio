/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureResource, TreeItem } from 'azdata';
import { TokenCredentials } from 'ms-rest';

import { azureResource } from '../azure-resource';
import { ApiWrapper } from '../../apiWrapper';
import { IAzureResourceService, AzureSqlResource } from '../interfaces';

export abstract class ResourceTreeDataProviderBase<T extends AzureSqlResource> implements azureResource.IAzureResourceTreeDataProvider {

	public constructor(
		protected _resourceService: IAzureResourceService<T>,
		protected _apiWrapper: ApiWrapper,
	) {
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

		const resources: T[] = await this._resourceService.getResources(element.subscription, credential) || <T[]>[];

		return resources.map((resource) => <azureResource.IAzureResourceNode>{
			account: element.account,
			subscription: element.subscription,
			tenantId: element.tenantId,
			treeItem: this.getTreeItemForResource(resource)
		}).sort((a, b) => a.treeItem.label.localeCompare(b.treeItem.label));
	}

	protected abstract getTreeItemForResource(resource: T): TreeItem;

	protected abstract createContainerNode(): azureResource.IAzureResourceNode;
}

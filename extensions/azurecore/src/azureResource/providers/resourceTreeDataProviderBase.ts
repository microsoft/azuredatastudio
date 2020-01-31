/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as msRest from '@azure/ms-rest-js';

import { azureResource } from '../azure-resource';
import { ApiWrapper } from '../../apiWrapper';
import { IAzureResourceService } from '../interfaces';
import { AzureResourceErrorMessageUtil } from '../utils';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';

export abstract class ResourceTreeDataProviderBase<T extends azureResource.AzureResource> implements azureResource.IAzureResourceTreeDataProvider {

	public constructor(
		protected _resourceService: IAzureResourceService<T>,
		protected _apiWrapper: ApiWrapper
	) {
	}

	public getTreeItem(element: azureResource.IAzureResourceNode): azdata.TreeItem | Thenable<azdata.TreeItem> {
		return element.treeItem;
	}

	public async getChildren(element?: azureResource.IAzureResourceNode): Promise<azureResource.IAzureResourceNode[]> {
		try {
			if (!element) {
				return [this.createContainerNode()];
			}

			let resources: T[] = await this.getResources(element);

			return resources.map((resource) => <azureResource.IAzureResourceNode>{
				account: element.account,
				subscription: element.subscription,
				tenantId: element.tenantId,
				treeItem: this.getTreeItemForResource(resource)
			}).sort((a, b) => a.treeItem.label.localeCompare(b.treeItem.label));
		} catch (error) {
			console.log(AzureResourceErrorMessageUtil.getErrorMessage(error));
			throw error;
		}
	}

	private async getResources(element: azureResource.IAzureResourceNode): Promise<T[]> {
		const tokens = await this._apiWrapper.getSecurityToken(element.account, azdata.AzureResource.ResourceManagement);
		const credential = new msRest.TokenCredentials(tokens[element.tenantId].token, tokens[element.tenantId].tokenType);

		const resources: T[] = await this._resourceService.getResources(element.subscription, credential) || <T[]>[];
		return resources;
	}

	protected abstract getTreeItemForResource(resource: T): azdata.TreeItem;

	protected abstract createContainerNode(): azureResource.IAzureResourceNode;
}

export interface GraphData {
	id: string;
	name: string;
	location: string;
	type: string;
	resourceGroup: string;
}


export async function queryGraphResources<T extends GraphData>(resourceClient: ResourceGraphClient, subId: string, resourceQuery: string): Promise<T[]> {
	const allResources: T[] = [];
	let totalProcessed = 0;
	let doQuery = async (skipToken?: string) => {
		const response = await resourceClient.resources({
			subscriptions: [subId],
			query: resourceQuery,
			options: {
				resultFormat: 'objectArray',
				skipToken: skipToken
			}
		});
		const resources: T[] = response.data;
		totalProcessed += resources.length;
		allResources.push(...resources);
		if (response.skipToken && totalProcessed < response.totalRecords) {
			await doQuery(response.skipToken);
		}
	};
	await doQuery();
	return allResources;
}

export abstract class ResourceServiceBase<T extends GraphData, U extends azureResource.AzureResource> implements IAzureResourceService<U> {
	constructor() {
	}

	/**
	 * The query to use - see https://docs.microsoft.com/azure/governance/resource-graph/concepts/query-language
	 * for more information on the supported syntax and tables/properties
	 */
	protected abstract get query(): string;

	public async getResources(subscription: azureResource.AzureResourceSubscription, credential: msRest.ServiceClientCredentials): Promise<U[]> {
		const convertedResources: U[] = [];
		const resourceClient = new ResourceGraphClient(credential);
		let graphResources = await queryGraphResources<T>(resourceClient, subscription.id, this.query);
		let ids = new Set<string>();
		graphResources.forEach((res) => {
			if (!ids.has(res.id)) {
				ids.add(res.id);
				let converted = this.convertResource(res);
				convertedResources.push(converted);
			}
		});

		return convertedResources;
	}

	protected abstract convertResource(resource: T): U;
}




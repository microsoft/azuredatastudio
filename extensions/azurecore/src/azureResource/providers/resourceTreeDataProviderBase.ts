/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as msRest from '@azure/ms-rest-js';

import { azureResource } from '../azure-resource';
import { IAzureResourceService } from '../interfaces';
import { AzureResourceErrorMessageUtil } from '../utils';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';

export abstract class ResourceTreeDataProviderBase<T extends azureResource.AzureResource> implements azureResource.IAzureResourceTreeDataProvider {

	public constructor(protected _resourceService: IAzureResourceService<T>) {
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
				treeItem: this.getTreeItemForResource(resource, element.account)
			}).sort((a, b) => a.treeItem.label.localeCompare(b.treeItem.label));
		} catch (error) {
			console.log(AzureResourceErrorMessageUtil.getErrorMessage(error));
			throw error;
		}
	}

	private async getResources(element: azureResource.IAzureResourceNode): Promise<T[]> {
		const response = await azdata.accounts.getAccountSecurityToken(element.account, element.tenantId, azdata.AzureResource.ResourceManagement);
		const credential = new msRest.TokenCredentials(response.token, response.tokenType);

		const resources: T[] = await this._resourceService.getResources(element.subscription, credential, element.account) || <T[]>[];
		return resources;
	}

	protected abstract getTreeItemForResource(resource: T, account: azdata.Account): azdata.TreeItem;

	protected abstract createContainerNode(): azureResource.IAzureResourceNode;
}

export interface GraphData {
	tenantId: string;
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
	try {
		await doQuery();
	} catch (err) {
		try {
			if (err.response?.body) {
				// The response object contains more useful error info than the error originally comes back with
				const response = JSON.parse(err.response.body);
				if (response.error?.details && Array.isArray(response.error.details) && response.error.details.length > 0) {
					if (response.error.details[0].message) {
						err.message = `${response.error.details[0].message}\n${err.message}`;
					}
					if (response.error.details[0].code) {
						err.message = `${err.message} (${response.error.details[0].code})`;
					}
				}
			}
		} catch (err2) {
			// Just log, we still want to throw the original error if something happens parsing the error
			console.log(`Unexpected error while parsing error from querying resources : ${err2}`);
		}
		throw err;
	}

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

	public async getResources(subscription: azureResource.AzureResourceSubscription, credential: msRest.ServiceClientCredentials, account: azdata.Account): Promise<U[]> {
		const convertedResources: U[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
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




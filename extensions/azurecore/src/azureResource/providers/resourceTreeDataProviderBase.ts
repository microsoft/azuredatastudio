/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as msRest from '@azure/ms-rest-js';

import { IAzureResourceService } from '../interfaces';
import { AzureResourceErrorMessageUtil } from '../utils';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { AzureAccount, azureResource } from 'azurecore';

export abstract class ResourceTreeDataProviderBase<T extends azureResource.AzureResource> implements azureResource.IAzureResourceTreeDataProvider {
	public browseConnectionMode: boolean = false;

	public constructor(protected _resourceService: IAzureResourceService<T>) {
	}

	public async getResourceTreeItem(element: azureResource.IAzureResourceNode): Promise<azdata.TreeItem> {
		return element.treeItem;
	}

	public async getChildren(element: azureResource.IAzureResourceNode): Promise<azureResource.IAzureResourceNode[]> {
		try {
			let resources: T[] = await this.getResources(element);

			return resources.map((resource) => <azureResource.IAzureResourceNode>{
				account: element.account,
				subscription: element.subscription,
				tenantId: element.subscription.tenant,
				treeItem: this.getTreeItemForResource(resource, element.account)
			}).sort((a, b) => (<any>a.treeItem.label).localeCompare(b.treeItem.label));
		} catch (error) {
			console.log(AzureResourceErrorMessageUtil.getErrorMessage(error));
			throw error;
		}
	}

	private async getResources(element: azureResource.IAzureResourceNode): Promise<T[]> {
		const response = await azdata.accounts.getAccountSecurityToken(element.account, element.subscription.tenant!, azdata.AzureResource.ResourceManagement);
		if (!response) {
			throw new Error(`Did not receive security token when getting resources for account ${element.account.displayInfo.displayName}`);
		}
		const credential = new msRest.TokenCredentials(response.token, response.tokenType);

		const resources: T[] = await this._resourceService.getResources([element.subscription], credential, element.account) || <T[]>[];
		return resources;
	}

	protected abstract getTreeItemForResource(resource: T, account: AzureAccount): azdata.TreeItem;

	public abstract getRootChildren(): Promise<azdata.TreeItem[]>;
}

export interface GraphData {
	subscriptionId: string,
	subscriptionName?: string,
	tenantId: string;
	id: string;
	name: string;
	location: string;
	type: string;
	resourceGroup: string;
}


export async function queryGraphResources<T extends GraphData>(resourceClient: ResourceGraphClient, subscriptions: azureResource.AzureResourceSubscription[], resourceQuery: string): Promise<T[]> {
	const allResources: T[] = [];
	let totalProcessed = 0;
	let doQuery = async (skipToken?: string) => {
		const response = await resourceClient.resources({
			subscriptions: subscriptions.map(subscription => subscription.id),
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

	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: msRest.ServiceClientCredentials, account: AzureAccount): Promise<U[]> {
		const convertedResources: U[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		const graphResources = await queryGraphResources<T>(resourceClient, subscriptions, this.query);
		const ids = new Set<string>();
		graphResources.forEach((res) => {
			if (!ids.has(res.id)) {
				ids.add(res.id);
				res.subscriptionName = subscriptions.find(sub => sub.id === res.subscriptionId)?.name;
				const converted = this.convertResource(res);
				convertedResources.push(converted);
			}
		});

		return convertedResources;
	}

	protected abstract convertResource(resource: T): U;
}




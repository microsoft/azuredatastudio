/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as msRest from '@azure/ms-rest-js';

import { GraphData, IAzureResourceDbService, IAzureResourceServerService } from '../interfaces';
import { AzureResourceErrorMessageUtil } from '../utils';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { AzureAccount, azureResource } from 'azurecore';
import { Logger } from '../../utils/Logger';
import { ErrorResponse } from '@azure/arm-resourcegraph/esm/models';
import { where } from './queryStringConstants';

export abstract class ResourceTreeDataProviderBase<S extends GraphData, T extends GraphData> implements azureResource.IAzureResourceTreeDataProvider {
	public browseConnectionMode: boolean = false;

	public constructor(
		protected _resourceService: azureResource.IAzureResourceService | IAzureResourceServerService<T> | IAzureResourceDbService<S, T>) {
	}

	public getService(): azureResource.IAzureResourceService {
		return this._resourceService;
	}

	public async getChildren(parent: azureResource.IAzureResourceNode): Promise<azureResource.IAzureResourceNode[]> {
		try {
			let resources: azureResource.AzureResource[] = await this.getResources(parent);
			return resources.map((resource) => this.convertDataToResource(resource, parent))
				.sort((a, b) => (<any>a.treeItem.label).localeCompare(b.treeItem.label));
		} catch (error) {
			Logger.error(AzureResourceErrorMessageUtil.getErrorMessage(error));
			throw error;
		}
	}

	public convertDataToResource(resource: azureResource.AzureResource, parent: azureResource.IAzureResourceNode): any {
		return <azureResource.IAzureResourceNode>{
			account: parent.account,
			subscription: parent.subscription,
			tenantId: parent.subscription.tenant,
			treeItem: this.getTreeItemForResource(resource, parent.account)
		}
	}

	private async getResources(element: azureResource.IAzureResourceNode): Promise<azureResource.AzureResource[]> {
		const response = await azdata.accounts.getAccountSecurityToken(element.account, element.subscription.tenant!, azdata.AzureResource.ResourceManagement);
		if (!response) {
			throw new Error(`Did not receive security token when getting resources for account ${element.account.displayInfo.displayName}`);
		}
		const credential = new msRest.TokenCredentials(response.token, response.tokenType);
		return await this._resourceService.getResources([element.subscription], credential, element.account) || <azureResource.AzureResource[]>[];
	}

	public abstract getTreeItemForResource(resource: azureResource.AzureResource, account: AzureAccount): azdata.TreeItem;

	public abstract getRootChildren(): Promise<azdata.TreeItem[]>;
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
		const resources: T[] = response.data as T[];
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
				const response = JSON.parse(err.response.body) as ErrorResponse;
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
			Logger.error(`Unexpected error while parsing error from querying resources : ${err2}`);
		}
		throw err;
	}

	return allResources;
}

export abstract class ResourceServiceBase<T extends GraphData> implements IAzureResourceServerService<T> {
	/**
	 * The query to use - see https://docs.microsoft.com/azure/governance/resource-graph/concepts/query-language
	 * for more information on the supported syntax and tables/properties
	 */
	public abstract queryFilter: string;

	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: msRest.ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResource[]> {
		const convertedResources: azureResource.AzureResource[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		const graphResources = await queryGraphResources<T>(resourceClient, subscriptions, where + this.queryFilter);
		const ids = new Set<string>();
		graphResources.forEach((res) => {
			if (!ids.has(res.id)) {
				ids.add(res.id);
				res.subscriptionName = subscriptions.find(sub => sub.id === res.subscriptionId)?.name;
				const converted = this.convertServerResource(res);
				convertedResources.push(converted!);
			}
		});

		return convertedResources;
	}

	public abstract convertServerResource(resource: T): azureResource.AzureResource | undefined;
}




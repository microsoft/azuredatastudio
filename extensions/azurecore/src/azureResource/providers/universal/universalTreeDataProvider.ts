/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as msRest from '@azure/ms-rest-js';

import { AzureResourceErrorMessageUtil } from '../../utils';
import { GraphData } from '../../interfaces';
import { ResourceTreeDataProviderBase } from '../resourceTreeDataProviderBase';
import { AzureAccount, azureResource } from 'azurecore';
import { Logger } from '../../../utils/Logger';
import { AzureResourceUniversalService } from './universalService';

export class AzureResourceUniversalTreeDataProvider<S extends GraphData, D extends GraphData>
	extends ResourceTreeDataProviderBase<S, D> implements azureResource.IAzureUniversalTreeDataProvider {

	public constructor(
		private universalService: azureResource.IAzureResourceService,
	) {
		super(universalService);
	}

	public override getService(): azureResource.IAzureResourceService {
		return this.universalService;
	}

	public override getChildren(element: azureResource.IAzureResourceNode): Promise<azureResource.IAzureResourceNode[]> {
		throw new Error('Method not supported for universal provider.');
	}

	public getTreeItemForResource(resource: azureResource.AzureResource, account: AzureAccount): azdata.TreeItem {
		let service: AzureResourceUniversalService = this.universalService as AzureResourceUniversalService;
		let provider = service.getRegisteredTreeDataProviderInstance(resource.provider!);
		provider.browseConnectionMode = this.browseConnectionMode;
		return provider.getTreeItemForResource(resource, account);
	}

	public async getRootChild(): Promise<azdata.TreeItem> {
		throw new Error('Method not supported');
	}

	public async getAllChildren(account: AzureAccount, subscriptions: azureResource.AzureResourceSubscription[]): Promise<azureResource.IAzureResourceNode[]> {
		try {
			let resources: azureResource.AzureResource[] = await this.getAllResources(account, subscriptions);
			return resources.map((resource) => <azureResource.IAzureResourceNode>{
				account: account,
				subscription: resource.subscription,
				tenantId: resource.tenant,
				resourceProviderId: resource.provider,
				treeItem: this.getTreeItemForResource(resource, account)
			}).sort((a, b) => (<any>a.treeItem.label).localeCompare(b.treeItem.label));
		} catch (error) {
			Logger.error(AzureResourceErrorMessageUtil.getErrorMessage(error));
			throw error;
		}
	}

	private async getAllResources(account: AzureAccount, subscriptions: azureResource.AzureResourceSubscription[]): Promise<azureResource.AzureResource[]> {
		let resources: azureResource.AzureResource[] = [];
		for (const tenant of account.properties.tenants) {
			const subs = subscriptions.filter(sub => sub.tenant === tenant.id);
			if (subs && subs.length > 0) {
				const response = await azdata.accounts.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.ResourceManagement);
				if (!response) {
					throw new Error(`Did not receive security token when getting resources for account ${account.displayInfo.displayName}`);
				}
				const credential = new msRest.TokenCredentials(response.token, response.tokenType);
				resources = resources.concat(await this.universalService.getResources(subs, credential, account));
			}
		}
		return resources;
	}
}

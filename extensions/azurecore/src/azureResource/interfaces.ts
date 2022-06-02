/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';

import { AzureAccount, Tenant, azureResource } from 'azurecore';

export interface IAzureResourceSubscriptionService {
	/**
	 * Gets subscriptions for the given account. Any errors that occur while fetching the subscriptions for each tenant
	 * will be displayed to the user, but this function will only throw an error if it's unable to fetch any subscriptions.
	 * @param account The account to get the subscriptions for
	 * @param tenantIds The list of tenant IDs to get subscriptions for - if undefined then subscriptions for all tenants will be retrieved
	 * @returns The list of all subscriptions on this account that were able to be retrieved
	 */
	getSubscriptions(account: AzureAccount, tenantIds?: string[] | undefined): Promise<azureResource.AzureResourceSubscription[]>;
}

export interface IAzureResourceSubscriptionFilterService {
	getSelectedSubscriptions(account: AzureAccount): Promise<azureResource.AzureResourceSubscription[]>;
	saveSelectedSubscriptions(account: AzureAccount, selectedSubscriptions: azureResource.AzureResourceSubscription[]): Promise<void>;
}

export interface IAzureTerminalService {
	getOrCreateCloudConsole(account: AzureAccount, tenant: Tenant): Promise<void>;
}

export interface IAzureResourceCacheService {
	generateKey(id: string): string;

	get<T>(key: string): T | undefined;

	update<T>(key: string, value: T): Promise<void>;
}


export interface IAzureResourceNodeWithProviderId {
	resourceProviderId: string;
	resourceNode: azureResource.IAzureResourceNode;
}

export interface IAzureResourceService<T extends azureResource.AzureResource> {
	getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: msRest.ServiceClientCredentials, account: AzureAccount): Promise<T[]>;
}

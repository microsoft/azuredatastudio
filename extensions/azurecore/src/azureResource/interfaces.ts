/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';

import { Account } from 'azdata';

import { azureResource } from 'azureResource';
import { AzureAccount, Tenant } from 'azurecore';

export interface IAzureResourceSubscriptionService {
	getSubscriptions(account: Account, credential: msRest.ServiceClientCredentials, tenantId: string): Promise<azureResource.AzureResourceSubscription[]>;
	getAllSubscriptions(account: Account): Promise<azureResource.AzureResourceSubscription[]>;
}

export interface IAzureResourceSubscriptionFilterService {
	getSelectedSubscriptions(account: Account): Promise<azureResource.AzureResourceSubscription[]>;
	saveSelectedSubscriptions(account: Account, selectedSubscriptions: azureResource.AzureResourceSubscription[]): Promise<void>;
}

export interface IAzureTerminalService {
	getOrCreateCloudConsole(account: AzureAccount, tenant: Tenant): Promise<void>;
}

export interface IAzureResourceCacheService {
	generateKey(id: string): string;

	get<T>(key: string): T | undefined;

	update<T>(key: string, value: T): void;
}


export interface IAzureResourceNodeWithProviderId {
	resourceProviderId: string;
	resourceNode: azureResource.IAzureResourceNode;
}

export interface IAzureResourceService<T extends azureResource.AzureResource> {
	getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: msRest.ServiceClientCredentials, account: Account): Promise<T[]>;
}

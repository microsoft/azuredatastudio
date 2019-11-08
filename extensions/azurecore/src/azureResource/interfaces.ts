/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';

import { Account, DidChangeAccountsParams } from 'azdata';
import { Event } from 'vscode';

import { azureResource } from './azure-resource';

export interface IAzureResourceAccountService {
	getAccounts(): Promise<Account[]>;
	readonly onDidChangeAccounts: Event<DidChangeAccountsParams>;
}

export interface IAzureResourceSubscriptionService {
	getSubscriptions(account: Account, credential: msRest.ServiceClientCredentials): Promise<azureResource.AzureResourceSubscription[]>;
}

export interface IAzureResourceSubscriptionFilterService {
	getSelectedSubscriptions(account: Account): Promise<azureResource.AzureResourceSubscription[]>;
	saveSelectedSubscriptions(account: Account, selectedSubscriptions: azureResource.AzureResourceSubscription[]): Promise<void>;
}

export interface IAzureResourceCacheService {
	generateKey(id: string): string;

	get<T>(key: string): T | undefined;

	update<T>(key: string, value: T): void;
}

export interface IAzureResourceTenantService {
	getTenantId(subscription: azureResource.AzureResourceSubscription): Promise<string>;
}

export interface IAzureResourceNodeWithProviderId {
	resourceProviderId: string;
	resourceNode: azureResource.IAzureResourceNode;
}

export interface AzureSqlResource {
	name: string;
	loginName: string;
}

export interface IAzureResourceService<T extends AzureSqlResource> {
	getResources(subscription: azureResource.AzureResourceSubscription, credential: msRest.ServiceClientCredentials): Promise<T[]>;
}


export interface AzureResourceDatabase extends AzureSqlResource {
	serverName: string;
	serverFullName: string;
}

export interface AzureResourceDatabaseServer extends AzureSqlResource {
	id?: string;
	fullName: string;
	defaultDatabaseName: string;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials } from 'ms-rest';
import { Account, DidChangeAccountsParams } from 'sqlops';
import { Event } from 'vscode';

import { azureResource } from './azure-resource';

export interface IAzureResourceAccountService {
	getAccounts(): Promise<Account[]>;

	readonly onDidChangeAccounts: Event<DidChangeAccountsParams>;
}

export interface IAzureResourceSubscriptionService {
	getSubscriptions(account: Account, credential: ServiceClientCredentials): Promise<azureResource.AzureResourceSubscription[]>;
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
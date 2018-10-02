/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials } from 'ms-rest';
import { Account, DidChangeAccountsParams } from 'sqlops';
import { Event } from 'vscode';

import { AzureResourceSubscription, AzureResourceDatabaseServer, AzureResourceDatabase } from './models';

export interface IAzureResourceAccountService {
	getAccounts(): Promise<Account[]>;

	readonly onDidChangeAccounts: Event<DidChangeAccountsParams>;
}

export interface IAzureResourceCredentialService {
	getCredentials(account: Account): Promise<ServiceClientCredentials[]>;
}

export interface IAzureResourceSubscriptionService {
	getSubscriptions(account: Account, credentials: ServiceClientCredentials[]): Promise<AzureResourceSubscription[]>;
}

export interface IAzureResourceSubscriptionFilterService {
	getSelectedSubscriptions(account: Account): Promise<AzureResourceSubscription[]>;

	saveSelectedSubscriptions(account: Account, selectedSubscriptions: AzureResourceSubscription[]): Promise<void>;
}

export interface IAzureResourceDatabaseServerService {
	getDatabaseServers(subscription: AzureResourceSubscription, credentials: ServiceClientCredentials[]): Promise<AzureResourceDatabaseServer[]>;
}

export interface IAzureResourceDatabaseService {
	getDatabases(subscription: AzureResourceSubscription, credentials: ServiceClientCredentials[]): Promise<AzureResourceDatabase[]>;
}

export interface IAzureResourceCacheService {
	get<T>(key: string): T | undefined;

	update<T>(key: string, value: T): void;
}

export interface IAzureResourceContextService {
	getAbsolutePath(relativePath: string): string;

	executeCommand(commandId: string, ...args: any[]): void;

	showErrorMessage(errorMessage: string): void;
}

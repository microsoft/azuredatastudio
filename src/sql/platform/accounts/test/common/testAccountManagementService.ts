/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Event } from 'vs/base/common/event';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/platform/accounts/common/eventTypes';

export class TestAccountManagementService implements IAccountManagementService {
	_serviceBrand: undefined;

	public get addAccountProviderEvent(): Event<AccountProviderAddedEventParams> { return Event.None; }
	public get removeAccountProviderEvent(): Event<azdata.AccountProviderMetadata> { return Event.None; }
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return Event.None; }

	accountUpdated(account: azdata.Account): Thenable<void> {
		return Promise.resolve();
	}

	addAccount(providerId: string): Thenable<void> {
		return Promise.resolve();
	}

	beginAutoOAuthDeviceCode(title: string, message: string, userCode: string, uri: string): Thenable<void> {
		return Promise.resolve();
	}

	cancelAutoOAuthDeviceCode(providerId: string): void {
		return undefined;
	}

	endAutoOAuthDeviceCode(): void {
		return undefined;
	}

	copyUserCodeAndOpenBrowser(userCode: string, uri: string): void {
		return undefined;
	}

	getAccountProviderMetadata(): Thenable<azdata.AccountProviderMetadata[]> {
		return Promise.resolve([]);
	}

	getAccountsForProvider(providerId: string): Thenable<azdata.Account[]> {
		return Promise.resolve([]);
	}

	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		return Promise.resolve([]);
	}

	removeAccount(accountKey: azdata.AccountKey): Thenable<boolean> {
		throw new Error('Method not implemented');
	}

	refreshAccount(account: azdata.Account): Thenable<azdata.Account> {
		throw new Error('Method not implemented');
	}

	openAccountListDialog(): Promise<any> {
		return Promise.resolve();
	}

	registerProvider(providerMetadata: azdata.AccountProviderMetadata, provider: azdata.AccountProvider): void {
		return undefined;
	}

	shutdown(): void {
		return undefined;
	}

	unregisterProvider(providerMetadata: azdata.AccountProviderMetadata): void {
		return undefined;
	}
}

export class AccountProviderStub implements azdata.AccountProvider {
	autoOAuthCancelled(): Thenable<void> {
		return Promise.resolve();
	}

	clear(account: azdata.AccountKey): Thenable<void> {
		return Promise.resolve();
	}

	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		return Promise.resolve({});
	}

	initialize(storedAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
		return Promise.resolve(storedAccounts);
	}

	prompt(): Thenable<azdata.Account> {
		throw new Error('Method not implemented');
	}

	refresh(account: azdata.Account): Thenable<azdata.Account> {
		return Promise.resolve(account);
	}
}

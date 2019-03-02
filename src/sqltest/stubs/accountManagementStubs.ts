/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import { Event } from 'vs/base/common/event';
import { IAccountManagementService } from 'sql/platform/accountManagement/common/interfaces';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/platform/accountManagement/common/eventTypes';
import { TPromise } from 'vs/base/common/winjs.base';

export class AccountManagementTestService implements IAccountManagementService {
	_serviceBrand: any;

	public get addAccountProviderEvent(): Event<AccountProviderAddedEventParams> { return () => { return undefined; }; }
	public get removeAccountProviderEvent(): Event<azdata.AccountProviderMetadata> { return () => { return undefined; }; }
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return () => { return undefined; }; }

	accountUpdated(account: azdata.Account): Thenable<void> {
		return undefined;
	}

	addAccount(providerId: string): Thenable<void> {
		return undefined;
	}

	beginAutoOAuthDeviceCode(title: string, message: string, userCode: string, uri: string): Thenable<void> {
		return undefined;
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
		return undefined;
	}

	getAccountsForProvider(providerId: string): Thenable<azdata.Account[]> {
		return undefined;
	}

	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		return undefined;
	}

	removeAccount(accountKey: azdata.AccountKey): Thenable<boolean> {
		return undefined;
	}

	refreshAccount(account: azdata.Account): Thenable<azdata.Account> {
		return undefined;
	}

	openAccountListDialog(): TPromise<any> {
		return undefined;
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
		return Promise.resolve(undefined);
	}

	refresh(account: azdata.Account): Thenable<azdata.Account> {
		return Promise.resolve(account);
	}
}

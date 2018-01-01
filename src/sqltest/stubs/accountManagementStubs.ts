/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import Event from 'vs/base/common/event';
import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/services/accountManagement/eventTypes';
import { TPromise } from 'vs/base/common/winjs.base';

export class AccountManagementTestService implements IAccountManagementService {
	_serviceBrand: any;

	public get addAccountProviderEvent(): Event<AccountProviderAddedEventParams> { return () => { return undefined; }; }
	public get removeAccountProviderEvent(): Event<sqlops.AccountProviderMetadata> { return () => { return undefined; }; }
	public get updateAccountListEvent(): Event<UpdateAccountListEventParams> { return () => { return undefined; }; }

	accountUpdated(account: sqlops.Account): Thenable<void> {
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

	getAccountProviderMetadata(): Thenable<sqlops.AccountProviderMetadata[]> {
		return undefined;
	}

	getAccountsForProvider(providerId: string): Thenable<sqlops.Account[]> {
		return undefined;
	}

	getSecurityToken(account: sqlops.Account): Thenable<{}> {
		return undefined;
	}

	removeAccount(accountKey: sqlops.AccountKey): Thenable<boolean> {
		return undefined;
	}

	refreshAccount(account: sqlops.Account): Thenable<sqlops.Account> {
		return undefined;
	}

	openAccountListDialog(): TPromise<any> {
		return undefined;
	}

	registerProvider(providerMetadata: sqlops.AccountProviderMetadata, provider: sqlops.AccountProvider): void {
		return undefined;
	}

	shutdown(): void {
		return undefined;
	}

	unregisterProvider(providerMetadata: sqlops.AccountProviderMetadata): void {
		return undefined;
	}
}

export class AccountProviderStub implements sqlops.AccountProvider {
	autoOAuthCancelled(): Thenable<void> {
		return Promise.resolve();
	}

	clear(account: sqlops.AccountKey): Thenable<void> {
		return Promise.resolve();
	}

	getSecurityToken(account: sqlops.Account): Thenable<{}> {
		return Promise.resolve({});
	}

	initialize(storedAccounts: sqlops.Account[]): Thenable<sqlops.Account[]> {
		return Promise.resolve(storedAccounts);
	}

	prompt(): Thenable<sqlops.Account> {
		return Promise.resolve(undefined);
	}

	refresh(account: sqlops.Account): Thenable<sqlops.Account> {
		return Promise.resolve(account);
	}
}

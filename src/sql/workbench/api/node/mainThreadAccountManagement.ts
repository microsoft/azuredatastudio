/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { TPromise } from 'vs/base/common/winjs.base';
import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import {
	ExtHostAccountManagementShape,
	MainThreadAccountManagementShape,
	SqlExtHostContext,
	SqlMainContext
} from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';

@extHostNamedCustomer(SqlMainContext.MainThreadAccountManagement)
export class MainThreadAccountManagement implements MainThreadAccountManagementShape {
	private _providerMetadata: { [handle: number]: sqlops.AccountProviderMetadata };
	private _proxy: ExtHostAccountManagementShape;
	private _toDispose: IDisposable[];

	constructor(
		extHostContext: IExtHostContext,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		this._providerMetadata = {};
		if (extHostContext) {
			this._proxy = extHostContext.get(SqlExtHostContext.ExtHostAccountManagement);
		}
		this._toDispose = [];
	}

	public $beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void> {
		return this._accountManagementService.beginAutoOAuthDeviceCode(providerId, title, message, userCode, uri);
	}

	public $endAutoOAuthDeviceCode(): void {
		return this._accountManagementService.endAutoOAuthDeviceCode();
	}

	$accountUpdated(updatedAccount: sqlops.Account): void {
		this._accountManagementService.accountUpdated(updatedAccount);
	}

	public $registerAccountProvider(providerMetadata: sqlops.AccountProviderMetadata, handle: number): Thenable<any> {
		let self = this;

		// Create the account provider that interfaces with the extension via the proxy and register it
		let accountProvider: sqlops.AccountProvider = {
			autoOAuthCancelled(): Thenable<void> {
				return self._proxy.$autoOAuthCancelled(handle);
			},
			clear(accountKey: sqlops.AccountKey): Thenable<void> {
				return self._proxy.$clear(handle, accountKey);
			},
			getSecurityToken(account: sqlops.Account): Thenable<{}> {
				return self._proxy.$getSecurityToken(handle, account);
			},
			initialize(restoredAccounts: sqlops.Account[]): Thenable<sqlops.Account[]> {
				return self._proxy.$initialize(handle, restoredAccounts);
			},
			prompt(): Thenable<sqlops.Account> {
				return self._proxy.$prompt(handle);
			},
			refresh(account: sqlops.Account): Thenable<sqlops.Account> {
				return self._proxy.$refresh(handle, account);
			}
		};
		this._accountManagementService.registerProvider(providerMetadata, accountProvider);
		this._providerMetadata[handle] = providerMetadata;

		return TPromise.as(null);
	}

	public $unregisterAccountProvider(handle: number): Thenable<any> {
		this._accountManagementService.unregisterProvider(this._providerMetadata[handle]);
		return TPromise.as(null);
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}
}

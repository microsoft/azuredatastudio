/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { Disposable } from 'vs/base/common/lifecycle';
import {
	ExtHostAccountManagementShape,
	MainThreadAccountManagementShape,
	SqlExtHostContext,
	SqlMainContext
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { UpdateAccountListEventParams } from 'sql/platform/accounts/common/eventTypes';
import { values } from 'vs/base/common/collections';
import { firstIndex } from 'vs/base/common/arrays';

@extHostNamedCustomer(SqlMainContext.MainThreadAccountManagement)
export class MainThreadAccountManagement extends Disposable implements MainThreadAccountManagementShape {
	private _providerMetadata: { [handle: number]: azdata.AccountProviderMetadata };
	private _proxy: ExtHostAccountManagementShape;

	constructor(
		extHostContext: IExtHostContext,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		super();
		this._providerMetadata = {};
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostAccountManagement);
		}

		this._accountManagementService.updateAccountListEvent((e: UpdateAccountListEventParams) => {
			if (!e) {
				return;
			}

			const providerMetadataIndex = firstIndex(values(this._providerMetadata), (providerMetadata: azdata.AccountProviderMetadata) => providerMetadata.id === e.providerId);
			if (providerMetadataIndex === -1) {
				return;
			}

			const providerHandle = parseInt(Object.keys(this._providerMetadata)[providerMetadataIndex]);
			this._proxy.$accountsChanged(providerHandle, e.accountList);
		});
	}

	public $beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void> {
		return this._accountManagementService.beginAutoOAuthDeviceCode(providerId, title, message, userCode, uri);
	}

	public $endAutoOAuthDeviceCode(): void {
		return this._accountManagementService.endAutoOAuthDeviceCode();
	}

	$accountUpdated(updatedAccount: azdata.Account): void {
		this._accountManagementService.accountUpdated(updatedAccount);
	}

	public $getAccountsForProvider(providerId: string): Thenable<azdata.Account[]> {
		return this._accountManagementService.getAccountsForProvider(providerId);
	}

	public $registerAccountProvider(providerMetadata: azdata.AccountProviderMetadata, handle: number): Thenable<any> {
		let self = this;

		// Create the account provider that interfaces with the extension via the proxy and register it
		let accountProvider: azdata.AccountProvider = {
			autoOAuthCancelled(): Thenable<void> {
				return self._proxy.$autoOAuthCancelled(handle);
			},
			clear(accountKey: azdata.AccountKey): Thenable<void> {
				return self._proxy.$clear(handle, accountKey);
			},

			getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
				return self._proxy.$getSecurityToken(account, resource);
			},
			getAccountSecurityToken(account: azdata.Account, tenant: string, resource: azdata.AzureResource): Thenable<{ token: string }> {
				return self._proxy.$getAccountSecurityToken(account, tenant, resource);
			},
			initialize(restoredAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
				return self._proxy.$initialize(handle, restoredAccounts);
			},
			prompt(): Thenable<azdata.Account | azdata.PromptFailedResult> {
				return self._proxy.$prompt(handle);
			},
			refresh(account: azdata.Account): Thenable<azdata.Account | azdata.PromptFailedResult> {
				return self._proxy.$refresh(handle, account);
			},
			clearTokenCache(): Thenable<void> {
				return self._proxy.$clearTokenCache();
			}
		};
		this._accountManagementService.registerProvider(providerMetadata, accountProvider);
		this._providerMetadata[handle] = providerMetadata;

		return Promise.resolve(null);
	}

	public $unregisterAccountProvider(handle: number): Thenable<any> {
		this._accountManagementService.unregisterProvider(this._providerMetadata[handle]);
		return Promise.resolve(null);
	}
}

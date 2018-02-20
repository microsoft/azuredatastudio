/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { TPromise } from 'vs/base/common/winjs.base';
import { IResourceProviderService } from 'sql/parts/accountManagement/common/interfaces';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import {
	ExtHostResourceProviderShape,
	MainThreadResourceProviderShape,
	SqlExtHostContext,
	SqlMainContext
} from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';


@extHostNamedCustomer(SqlMainContext.MainThreadResourceProvider)
export class MainThreadResourceProvider implements MainThreadResourceProviderShape {
	private _providerMetadata: { [handle: number]: sqlops.AccountProviderMetadata };
	private _proxy: ExtHostResourceProviderShape;
	private _toDispose: IDisposable[];

	constructor(
		extHostContext: IExtHostContext,
		@IResourceProviderService private _resourceProviderService: IResourceProviderService
	) {
		this._providerMetadata = {};
		if (extHostContext) {
			this._proxy = extHostContext.get(SqlExtHostContext.ExtHostResourceProvider);
		}
		this._toDispose = [];
	}

	public $registerResourceProvider(providerMetadata: sqlops.ResourceProviderMetadata, handle: number): Thenable<any> {
		let self = this;

		// Create the account provider that interfaces with the extension via the proxy and register it
		let resourceProvider: sqlops.ResourceProvider = {
			createFirewallRule(account: sqlops.Account, firewallruleInfo: sqlops.FirewallRuleInfo): Thenable<sqlops.CreateFirewallRuleResponse> {
				return self._proxy.$createFirewallRule(handle, account, firewallruleInfo);
			},
			handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<sqlops.HandleFirewallRuleResponse> {
				return self._proxy.$handleFirewallRule(handle, errorCode, errorMessage, connectionTypeId);
			}
		};
		this._resourceProviderService.registerProvider(providerMetadata.id, resourceProvider);
		this._providerMetadata[handle] = providerMetadata;

		return TPromise.as(null);
	}

	public $unregisterResourceProvider(handle: number): Thenable<any> {
		this._resourceProviderService.unregisterProvider(this._providerMetadata[handle].id);
		return TPromise.as(null);
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IResourceProviderService } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import { Disposable } from 'vs/base/common/lifecycle';
import {
	ExtHostResourceProviderShape,
	MainThreadResourceProviderShape,
	SqlExtHostContext,
	SqlMainContext
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';


@extHostNamedCustomer(SqlMainContext.MainThreadResourceProvider)
export class MainThreadResourceProvider extends Disposable implements MainThreadResourceProviderShape {
	private _providerMetadata: { [handle: number]: azdata.AccountProviderMetadata };
	private _proxy: ExtHostResourceProviderShape;

	constructor(
		extHostContext: IExtHostContext,
		@IResourceProviderService private _resourceProviderService: IResourceProviderService
	) {
		super();
		this._providerMetadata = {};
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostResourceProvider);
		}
	}

	public $registerResourceProvider(providerMetadata: azdata.ResourceProviderMetadata, handle: number): Thenable<any> {
		let self = this;

		// Create the account provider that interfaces with the extension via the proxy and register it
		let resourceProvider: azdata.ResourceProvider = {
			createFirewallRule(account: azdata.Account, firewallruleInfo: azdata.FirewallRuleInfo): Thenable<azdata.CreateFirewallRuleResponse> {
				return self._proxy.$createFirewallRule(handle, account, firewallruleInfo);
			},
			handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<azdata.HandleFirewallRuleResponse> {
				return self._proxy.$handleFirewallRule(handle, errorCode, errorMessage, connectionTypeId);
			}
		};
		this._resourceProviderService.registerProvider(providerMetadata.id, resourceProvider);
		this._providerMetadata[handle] = providerMetadata;

		return Promise.resolve(null);
	}

	public $unregisterResourceProvider(handle: number): Thenable<any> {
		this._resourceProviderService.unregisterProvider(this._providerMetadata[handle].id);
		return Promise.resolve(null);
	}
}

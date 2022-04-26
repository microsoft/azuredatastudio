/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azurecore from 'azurecore';
import { Disposable } from 'vs/base/common/lifecycle';
import {
	ExtHostAzureAccountShape,
	MainThreadAzureAccountShape,
	SqlExtHostContext,
	SqlMainContext
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IAzureAccountService } from 'sql/platform/azureAccount/common/azureAccountService';
import { AzureAccountService } from 'sql/workbench/services/azureAccount/browser/azureAccountService';

@extHostNamedCustomer(SqlMainContext.MainThreadAzureAccount)
export class MainThreadAzureAccount extends Disposable implements MainThreadAzureAccountShape {
	private _proxy: ExtHostAzureAccountShape;
	public _serviceBrand: undefined;

	constructor(
		extHostContext: IExtHostContext,
		@IAzureAccountService azureAccountService: IAzureAccountService
	) {
		super();
		this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostAzureAccount);
		(azureAccountService as AzureAccountService).registerProxy(this);
	}

	public async getSubscriptions(account: azurecore.AzureAccount, ignoreErrors?: boolean, selectedOnly?: boolean): Promise<azurecore.GetSubscriptionsResult> {
		return this._proxy.$getSubscriptions(account, ignoreErrors, selectedOnly);
	}

}

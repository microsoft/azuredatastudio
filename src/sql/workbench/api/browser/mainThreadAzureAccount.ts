/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azurecore from 'azurecore';
import { Disposable } from 'vs/base/common/lifecycle';
import {
	ExtHostAzureAccountShape,
	MainThreadAzureAccountShape
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IAzureAccountService } from 'sql/platform/azureAccount/common/azureAccountService';
import { AzureAccountService } from 'sql/workbench/services/azureAccount/browser/azureAccountService';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { SqlExtHostContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

@extHostNamedCustomer(SqlMainContext.MainThreadAzureAccount)
export class MainThreadAzureAccount extends Disposable implements MainThreadAzureAccountShape {
	private _proxy: ExtHostAzureAccountShape;
	public _serviceBrand: undefined;

	constructor(
		extHostContext: IExtHostContext,
		@IAzureAccountService azureAccountService: IAzureAccountService
	) {
		super();
		this._proxy = <ExtHostAzureAccountShape><unknown>extHostContext.getProxy(SqlExtHostContext.ExtHostAzureAccount);
		(azureAccountService as AzureAccountService).registerProxy(this);
	}

	public async getSubscriptions(account: azurecore.AzureAccount, ignoreErrors?: boolean, selectedOnly?: boolean): Promise<azurecore.GetSubscriptionsResult> {
		return this._proxy.$getSubscriptions(account, ignoreErrors, selectedOnly);
	}

	public getStorageAccounts(account: azurecore.AzureAccount, subscriptions: azurecore.azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<azurecore.GetStorageAccountResult> {
		return this._proxy.$getStorageAccounts(account, subscriptions, ignoreErrors);
	}

	public getBlobContainers(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<azurecore.GetBlobContainersResult> {
		return this._proxy.$getBlobContainers(account, subscription, storageAccount, ignoreErrors);
	}

	public getBlobs(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, containerName: string, ignoreErrors?: boolean): Promise<azurecore.GetBlobsResult> {
		return this._proxy.$getBlobs(account, subscription, storageAccount, containerName, ignoreErrors);
	}

	public getStorageAccountAccessKey(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<azurecore.GetStorageAccountAccessKeyResult> {
		return this._proxy.$getStorageAccountAccessKey(account, subscription, storageAccount, ignoreErrors);
	}

}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azurecore from 'azurecore';
import { IAzureAccountService } from 'sql/platform/azureAccount/common/azureAccountService';
import { MainThreadAzureAccount } from 'sql/workbench/api/browser/mainThreadAzureAccount';

/**
 * Service that provides access to the azurecore extension capabilities (such as getting subscriptions
 * for an Azure account)
 */
export class AzureAccountService implements IAzureAccountService {

	public _serviceBrand: undefined;
	private _proxy: MainThreadAzureAccount;

	/**
	 * Internal use only, do not call! This is called once on startup by the proxy object used
	 * to communicate with the extension host once it's been created.
	 * @param proxy The proxy to use to communicate with the azurecore extension
	 */
	public registerProxy(proxy: MainThreadAzureAccount) {
		this._proxy = proxy;
	}

	/**
	 * Gets the list of subscriptions for the specified AzureAccount
	 * @param account The account to get the subscriptions for
	 * @param ignoreErrors If true any errors are not thrown and instead collected and returned as part of the result
	 * @param selectedOnly Whether to only list subscriptions the user has selected to filter to for this account
	 */
	public getSubscriptions(account: azurecore.AzureAccount, ignoreErrors?: boolean, selectedOnly?: boolean): Promise<azurecore.GetSubscriptionsResult> {
		this.checkProxy();
		return this._proxy.getSubscriptions(account, ignoreErrors, selectedOnly);
	}

	public getStorageAccounts(account: azurecore.AzureAccount, subscriptions: azurecore.azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<azurecore.GetStorageAccountResult> {
		this.checkProxy();
		return this._proxy.getStorageAccounts(account, subscriptions, ignoreErrors);
	}

	public getBlobContainers(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<azurecore.GetBlobContainersResult> {
		this.checkProxy();
		return this._proxy.getBlobContainers(account, subscription, storageAccount, ignoreErrors);
	}

	public getBlobs(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, containerName: string, ignoreErrors?: boolean): Promise<azurecore.GetBlobsResult> {
		this.checkProxy();
		return this._proxy.getBlobs(account, subscription, storageAccount, containerName, ignoreErrors);
	}

	public getStorageAccountAccessKey(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<azurecore.GetStorageAccountAccessKeyResult> {
		this.checkProxy();
		return this._proxy.getStorageAccountAccessKey(account, subscription, storageAccount, ignoreErrors);
	}

	private checkProxy(): void {
		if (!this._proxy) {
			throw new Error('Azure Account proxy not initialized');
		}
	}
}

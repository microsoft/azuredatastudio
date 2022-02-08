/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//import * as azureResource from './azureResource/azureResource';
import * as azurecore from 'azurecore';
import * as azureResourceUtils from './resourceUtils';
//import * as utils from './utils';

export class AzureApi implements azurecore.IExtension {

	getSubscriptions(account?: azurecore.AzureAccount, ignoreErrors?: boolean, selectedOnly: boolean = false): Promise<azurecore.GetSubscriptionsResult> {
		return azureResourceUtils.getSubscriptions(account, ignoreErrors);
	}

	/*getStorageAccounts(account: azurecore.AzureAccount,
		subscriptions: azureResource.AzureResourceSubscription[],
		ignoreErrors: boolean): Promise<azurecore.GetStorageAccountResult> {
		return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, `where type == "${azureResource.AzureResourceType.storageAccount}"`);
	}

	getBlobContainers(account: azurecore.AzureAccount,
		subscription: azureResource.AzureResourceSubscription,
		storageAccount: azureResource.AzureGraphResource,
		ignoreErrors: boolean): Promise<azurecore.GetBlobContainersResult> {
		return azureResourceUtils.getBlobContainers(account, subscription, storageAccount, ignoreErrors);
	}

	getFileShares(account: azurecore.AzureAccount,
		subscription: azureResource.AzureResourceSubscription,
		storageAccount: azureResource.AzureGraphResource,
		ignoreErrors: boolean): Promise<azurecore.GetFileSharesResult> {
		return azureResourceUtils.getFileShares(account, subscription, storageAccount, ignoreErrors);
	}

	getStorageAccountAccessKey(account: azurecore.AzureAccount,
		subscription: azureResource.AzureResourceSubscription,
		storageAccount: azureResource.AzureGraphResource,
		ignoreErrors: boolean): Promise<azurecore.GetStorageAccountAccessKeyResult> {
		return azureResourceUtils.getStorageAccountAccessKey(account, subscription, storageAccount, ignoreErrors);
	}

	getBlobs(account: azurecore.AzureAccount,
		subscription: azureResource.AzureResourceSubscription,
		storageAccount: azureResource.AzureGraphResource,
		containerName: string,
		ignoreErrors: boolean): Promise<azurecore.GetBlobsResult> {
		return azureResourceUtils.getBlobs(account, subscription, storageAccount, containerName, ignoreErrors);
	}

	makeAzureRestRequest(account: azurecore.AzureAccount,
		subscription: azureResource.AzureResourceSubscription,
		path: string,
		requestType: azurecore.HttpRequestMethod,
		requestBody: any,
		ignoreErrors: boolean,
		host: string = 'https://management.azure.com',
		requestHeaders: { [key: string]: string } = {}): Promise<azurecore.AzureRestResponse> {
		return azureResourceUtils.makeHttpRequest(account, subscription, path, requestType, requestBody, ignoreErrors, host, requestHeaders);
	}


	getRegionDisplayName(region?: string): string {
		return utils.getRegionDisplayName(region);
	}

	runGraphQuery<T extends azureResource.AzureGraphResource>(account: azurecore.AzureAccount,
		subscriptions: azureResource.AzureResourceSubscription[],
		ignoreErrors: boolean,
		query: string): Promise<azurecore.ResourceQueryResult<T>> {
		return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, query);
	}*/
}

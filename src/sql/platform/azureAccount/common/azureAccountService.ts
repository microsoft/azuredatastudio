/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azurecore from 'azurecore';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'azureAccountService';

export const IAzureAccountService = createDecorator<IAzureAccountService>(SERVICE_ID);

export interface IAzureAccountService {
	_serviceBrand: undefined;
	getSubscriptions(account: azurecore.AzureAccount): Promise<azurecore.GetSubscriptionsResult>;
	getStorageAccounts(account: azurecore.AzureAccount, subscriptions: azurecore.azureResource.AzureResourceSubscription[]): Promise<azurecore.GetStorageAccountResult>;
	getBlobContainers(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource): Promise<azurecore.GetBlobContainersResult>;
	getBlobs(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, containerName: string, ignoreErrors?: boolean): Promise<azurecore.GetBlobsResult>;
	getStorageAccountAccessKey(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<azurecore.GetStorageAccountAccessKeyResult>;
}

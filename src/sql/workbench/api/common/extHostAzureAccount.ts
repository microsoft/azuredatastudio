/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azurecore from 'azurecore';
import { ExtHostAzureAccountShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { IExtHostExtensionService } from 'vs/workbench/api/common/extHostExtensionService';

export class ExtHostAzureAccount extends ExtHostAzureAccountShape {

	constructor(@IExtHostExtensionService private _extHostExtensionService: IExtHostExtensionService,) {
		super();
	}

	public override $getSubscriptions(account: azurecore.AzureAccount, ignoreErrors?: boolean, selectedOnly?: boolean): Thenable<azurecore.GetSubscriptionsResult> {
		const api = this.getApi();
		return api.getSubscriptions(account, ignoreErrors, selectedOnly);
	}

	public override $getStorageAccounts(account: azurecore.AzureAccount, subscriptions: azurecore.azureResource.AzureResourceSubscription[], ignoreErrors?: boolean): Promise<azurecore.GetStorageAccountResult> {
		const api = this.getApi();
		return api.getStorageAccounts(account, subscriptions, ignoreErrors);
	}

	public override $getBlobContainers(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<azurecore.GetBlobContainersResult> {
		const api = this.getApi();
		return api.getBlobContainers(account, subscription, storageAccount);
	}

	public override $getBlobs(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, containerName: string, ignoreErrors?: boolean): Promise<azurecore.GetBlobsResult> {
		const api = this.getApi();
		return api.getBlobs(account, subscription, storageAccount, containerName, ignoreErrors);
	}

	public override $getStorageAccountAccessKey(account: azurecore.AzureAccount, subscription: azurecore.azureResource.AzureResourceSubscription, storageAccount: azurecore.azureResource.AzureGraphResource, ignoreErrors?: boolean): Promise<azurecore.GetStorageAccountAccessKeyResult> {
		const api = this.getApi();
		return api.getStorageAccountAccessKey(account, subscription, storageAccount, ignoreErrors);
	}

	private getApi(): azurecore.IExtension {
		return this._extHostExtensionService.getExtensionExports(new ExtensionIdentifier(azurecore.extension.name)) as azurecore.IExtension;
	}
}

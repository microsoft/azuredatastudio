/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as azurecore from 'azurecore';

export class AzurecoreApiStub implements azurecore.IExtension {
	getStorageAccountAccessKey(_account: azdata.Account, _subscription: azurecore.azureResource.AzureResourceSubscription, _storageAccount: azurecore.azureResource.AzureGraphResource, _ignoreErrors?: boolean): Promise<azurecore.GetStorageAccountAccessKeyResult> {
		throw new Error('Method not implemented.');
	}
	getBlobs(_account: azdata.Account, _subscription: azurecore.azureResource.AzureResourceSubscription, _storageAccount: azurecore.azureResource.AzureGraphResource, _containerName: string, _ignoreErrors?: boolean): Promise<azurecore.GetBlobsResult> {
		throw new Error('Method not implemented.');
	}
	createResourceGroup(_account: azdata.Account, _subscription: azurecore.azureResource.AzureResourceSubscription, _resourceGroupName: string, _location: string, _ignoreErrors?: boolean): Promise<azurecore.CreateResourceGroupResult> {
		throw new Error('Method not implemented.');
	}
	getManagedDatabases(_account: azdata.Account, _subscription: azurecore.azureResource.AzureResourceSubscription, _managedInstance: azurecore.azureResource.AzureGraphResource, _ignoreErrors?: boolean): Promise<azurecore.GetManagedDatabasesResult> {
		throw new Error('Method not implemented.');
	}
	getLocations(_account?: azdata.Account, _subscription?: azurecore.azureResource.AzureResourceSubscription, _ignoreErrors?: boolean): Promise<azurecore.GetLocationsResult> {
		throw new Error('Method not implemented.');
	}
	makeAzureRestRequest(_account: azdata.Account, _subscription: azurecore.azureResource.AzureResourceSubscription, _serviceUrl: string, _requestType: azurecore.HttpRequestMethod, _requestBody?: any, _ignoreErrors?: boolean): Promise<azurecore.AzureRestResponse> {
		throw new Error('Method not implemented.');
	}
	getFileShares(_account: azdata.Account, _subscription: azurecore.azureResource.AzureResourceSubscription, _storageAccount: azurecore.azureResource.AzureGraphResource, _ignoreErrors?: boolean): Promise<azurecore.GetFileSharesResult> {
		throw new Error('Method not implemented.');
	}
	getBlobContainers(_account: azdata.Account, _subscription: azurecore.azureResource.AzureResourceSubscription, _storageAccount: azurecore.azureResource.AzureGraphResource, _ignoreErrors?: boolean): Promise<azurecore.GetBlobContainersResult> {
		throw new Error('Method not implemented.');
	}
	getSqlManagedInstances(_account: azdata.Account, _subscriptions: azurecore.azureResource.AzureResourceSubscription[], _ignoreErrors?: boolean): Promise<azurecore.GetSqlManagedInstancesResult> {
		throw new Error('Method not implemented.');
	}
	getSqlServers(_account: azdata.Account, _subscriptions: azurecore.azureResource.AzureResourceSubscription[], _ignoreErrors?: boolean): Promise<azurecore.GetSqlServersResult> {
		throw new Error('Method not implemented.');
	}
	getSqlVMServers(_account: azdata.Account, _subscriptions: azurecore.azureResource.AzureResourceSubscription[], _ignoreErrors?: boolean): Promise<azurecore.GetSqlVMServersResult> {
		throw new Error('Method not implemented.');
	}
	getStorageAccounts(_account: azdata.Account, _subscriptions: azurecore.azureResource.AzureResourceSubscription[], _ignoreErrors?: boolean): Promise<azurecore.GetStorageAccountResult> {
		throw new Error('Method not implemented.');
	}
	runGraphQuery<T extends azurecore.azureResource.AzureGraphResource>(_account: azdata.Account, _subscriptions: azurecore.azureResource.AzureResourceSubscription[], _ignoreErrors: boolean, _query: string): Promise<azurecore.ResourceQueryResult<T>> {
		throw new Error('Method not implemented.');
	}
	getSubscriptions(_account?: azdata.Account | undefined, _ignoreErrors?: boolean | undefined, _selectedOnly?: boolean | undefined): Promise<azurecore.GetSubscriptionsResult> {
		throw new Error('Method not implemented.');
	}
	getResourceGroups(_account?: azdata.Account | undefined, _subscription?: azurecore.azureResource.AzureResourceSubscription | undefined, _ignoreErrors?: boolean | undefined): Promise<azurecore.GetResourceGroupsResult> {
		throw new Error('Method not implemented.');
	}
	getRegionDisplayName(_region?: string | undefined): string {
		throw new Error('Method not implemented.');
	}
	getProviderMetadataForAccount(_account: azurecore.AzureAccount): azurecore.AzureAccountProviderMetadata {
		throw new Error('Method not implemented.');
	}
	provideResources(): azurecore.azureResource.IAzureResourceProvider[] {
		throw new Error('Method not implemented.');
	}

}

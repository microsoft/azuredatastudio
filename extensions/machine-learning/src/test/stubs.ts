/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as azurecore from 'azurecore';
import { azureResource } from 'azureResource';

export class AzurecoreApiStub implements azurecore.IExtension {
	runGraphQuery<T extends azureResource.AzureGraphResource>(_account: azdata.Account, _subscriptions: azureResource.AzureResourceSubscription[], _ignoreErrors: boolean, _query: string): Promise<azurecore.ResourceQueryResult<T>> {
		throw new Error('Method not implemented.');
	}
	getSubscriptions(_account?: azdata.Account | undefined, _ignoreErrors?: boolean | undefined): Thenable<azurecore.GetSubscriptionsResult> {
		throw new Error('Method not implemented.');
	}
	getResourceGroups(_account?: azdata.Account | undefined, _subscription?: azureResource.AzureResourceSubscription | undefined, _ignoreErrors?: boolean | undefined): Thenable<azurecore.GetResourceGroupsResult> {
		throw new Error('Method not implemented.');
	}
	getRegionDisplayName(_region?: string | undefined): string {
		throw new Error('Method not implemented.');
	}
	provideResources(): azureResource.IAzureResourceProvider[] {
		throw new Error('Method not implemented.');
	}

}

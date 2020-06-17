/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as azurecore from '../../../azurecore/src/azurecore';
import { azureResource } from '../../../azurecore/src/azureResource/azure-resource';

export class AzurecoreApiStub implements azurecore.IExtension {
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

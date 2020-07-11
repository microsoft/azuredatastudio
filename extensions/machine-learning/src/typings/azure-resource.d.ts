/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Account } from 'azdata';
import * as msRest from '@azure/ms-rest-js';

export namespace azureResource {

	export interface AzureResource {
		name: string;
		id: string;
	}

	export interface AzureResourceSubscription extends AzureResource {
	}

	export interface AzureResourceResourceGroup extends AzureResource {
	}

	export interface IAzureResourceService<T extends AzureResource> {
		getResources(subscription: AzureResourceSubscription, credential: msRest.ServiceClientCredentials): Promise<T[]>;
	}

	export type GetSubscriptionsResult = { subscriptions: AzureResourceSubscription[], errors: Error[] };
	export type GetResourceGroupsResult = { resourceGroups: AzureResourceResourceGroup[], errors: Error[] };
}

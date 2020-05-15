/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Account } from 'azdata';

import { azureResource } from '../azure-resource';
import { IAzureResourceSubscriptionFilterService, IAzureResourceCacheService } from '../interfaces';

interface AzureResourceSelectedSubscriptionsCache {
	selectedSubscriptions: { [accountId: string]: azureResource.AzureResourceSubscription[] };
}

export class AzureResourceSubscriptionFilterService implements IAzureResourceSubscriptionFilterService {
	public constructor(
		cacheService: IAzureResourceCacheService
	) {
		this._cacheService = cacheService;

		this._cacheKey = this._cacheService.generateKey('selectedSubscriptions');
	}

	public async getSelectedSubscriptions(account: Account): Promise<azureResource.AzureResourceSubscription[]> {
		let selectedSubscriptions: azureResource.AzureResourceSubscription[] = [];

		const cache = this._cacheService.get<AzureResourceSelectedSubscriptionsCache>(this._cacheKey);
		if (cache) {
			selectedSubscriptions = cache.selectedSubscriptions[account.key.accountId];
		}

		return selectedSubscriptions;
	}

	public async saveSelectedSubscriptions(account: Account, selectedSubscriptions: azureResource.AzureResourceSubscription[]): Promise<void> {
		let selectedSubscriptionsCache: { [accountId: string]: azureResource.AzureResourceSubscription[] } = {};

		const cache = this._cacheService.get<AzureResourceSelectedSubscriptionsCache>(this._cacheKey);
		if (cache) {
			selectedSubscriptionsCache = cache.selectedSubscriptions;
		}

		if (!selectedSubscriptionsCache) {
			selectedSubscriptionsCache = {};
		}

		selectedSubscriptionsCache[account.key.accountId] = selectedSubscriptions;

		this._cacheService.update<AzureResourceSelectedSubscriptionsCache>(this._cacheKey, { selectedSubscriptions: selectedSubscriptionsCache });

		const filters: string[] = [];
		for (const accountId in selectedSubscriptionsCache) {
			filters.push(...selectedSubscriptionsCache[accountId].map((subcription) => `${accountId}/${subcription.id}/${subcription.name}`));
		}
	}

	private _cacheService: IAzureResourceCacheService = undefined;
	private _cacheKey: string = undefined;
}

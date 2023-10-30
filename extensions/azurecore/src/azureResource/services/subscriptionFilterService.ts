/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureAccount, Tenant, azureResource } from 'azurecore';
import { IAzureResourceSubscriptionFilterService, IAzureResourceCacheService } from '../interfaces';

interface AzureResourceSelectedSubscriptionsCache {
	selectedSubscriptions: { [accountTenantId: string]: azureResource.AzureResourceSubscription[] };
}

export class AzureResourceSubscriptionFilterService implements IAzureResourceSubscriptionFilterService {
	private _cacheKey: string;

	public constructor(
		private _cacheService: IAzureResourceCacheService
	) {
		this._cacheKey = this._cacheService.generateKey('selectedSubscriptions');
	}

	public async getSelectedSubscriptions(account: AzureAccount, tenant: Tenant): Promise<azureResource.AzureResourceSubscription[]> {
		let selectedSubscriptions: azureResource.AzureResourceSubscription[] = [];

		const cache = this._cacheService.get<AzureResourceSelectedSubscriptionsCache>(this._cacheKey);
		if (cache) {
			selectedSubscriptions = cache.selectedSubscriptions[account.key.accountId + '/' + tenant.id];
			if (!selectedSubscriptions) {
				let oldTenantCache = cache.selectedSubscriptions[account.key.accountId]?.filter(sub => sub.tenant === tenant.id);
				if (oldTenantCache) {
					await this.saveSelectedSubscriptions(account, tenant, oldTenantCache);
				}
			}
		}
		return selectedSubscriptions;
	}

	public async saveSelectedSubscriptions(account: AzureAccount, tenant: Tenant, selectedSubscriptions: azureResource.AzureResourceSubscription[]): Promise<void> {
		let selections: { [accountTenantId: string]: azureResource.AzureResourceSubscription[] } = {};

		const cache = this._cacheService.get<AzureResourceSelectedSubscriptionsCache>(this._cacheKey);
		if (cache) {
			selections = cache.selectedSubscriptions;
		}

		if (!selections) {
			selections = {};
		}

		let accountTenantId = account.key.accountId;
		if (tenant) {
			accountTenantId += '/' + tenant.id;
		}

		selections[accountTenantId] = selectedSubscriptions;

		await this._cacheService.update<AzureResourceSelectedSubscriptionsCache>(this._cacheKey, { selectedSubscriptions: selections });

		const filters: string[] = [];
		filters.push(...selections[accountTenantId].map((subscription) => `${accountTenantId}/${subscription.id}`));
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureAccount, Tenant } from 'azurecore';
import { IAzureResourceTenantFilterService, IAzureResourceCacheService } from '../interfaces';

interface AzureResourceSelectedTenantsCache {
	selectedTenants: { [accountId: string]: Tenant[] };
}

export class AzureResourceTenantFilterService implements IAzureResourceTenantFilterService {
	private _cacheKey: string;

	public constructor(
		private _cacheService: IAzureResourceCacheService
	) {
		this._cacheKey = this._cacheService.generateKey('selectedTenants');
	}

	public async getSelectedTenants(account: AzureAccount): Promise<Tenant[]> {
		let selectedTenants: Tenant[] = [];

		const cache = this._cacheService.get<AzureResourceSelectedTenantsCache>(this._cacheKey);
		if (cache) {
			selectedTenants = cache.selectedTenants[account.key.accountId];
		}

		return selectedTenants;
	}

	public async saveSelectedTenants(account: AzureAccount, selectedTenants: Tenant[]): Promise<void> {
		let selectedTenantsCache: { [accountId: string]: Tenant[] } = {};

		const cache = this._cacheService.get<AzureResourceSelectedTenantsCache>(this._cacheKey);
		if (cache) {
			selectedTenantsCache = cache.selectedTenants;
		}

		if (!selectedTenantsCache) {
			selectedTenantsCache = {};
		}

		selectedTenantsCache[account.key.accountId] = selectedTenants;

		await this._cacheService.update<AzureResourceSelectedTenantsCache>(this._cacheKey, { selectedTenants: selectedTenantsCache });

		const filters: string[] = [];
		for (const accountId in selectedTenantsCache) {
			filters.push(...selectedTenantsCache[accountId].map((tenant) => `${accountId}/${tenant.id}/${tenant.displayName}`));
		}
	}
}

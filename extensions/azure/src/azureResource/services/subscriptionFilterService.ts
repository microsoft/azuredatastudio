/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { WorkspaceConfiguration, ConfigurationTarget } from 'vscode';
import { Account } from 'sqlops';

import { IAzureResourceSubscriptionFilterService, IAzureResourceCacheService } from '../interfaces';
import { AzureResourceSubscription } from '../models';

interface AzureResourceSelectedSubscriptionsCache {
	selectedSubscriptions: { [accountId: string]: AzureResourceSubscription[]};
}

export class AzureResourceSubscriptionFilterService implements IAzureResourceSubscriptionFilterService {
	public constructor(
		cacheService: IAzureResourceCacheService
	) {
		this._cacheService = cacheService;
	}

	public async getSelectedSubscriptions(account: Account): Promise<AzureResourceSubscription[]> {
		let selectedSubscriptions: AzureResourceSubscription[] = [];

		const cache = this._cacheService.get<AzureResourceSelectedSubscriptionsCache>(AzureResourceSubscriptionFilterService.CacheKey);
		if (cache) {
			selectedSubscriptions = cache.selectedSubscriptions[account.key.accountId];
		}

		return selectedSubscriptions;
	}

	public async saveSelectedSubscriptions(account: Account, selectedSubscriptions: AzureResourceSubscription[]): Promise<void> {
		let selectedSubscriptionsCache: { [accountId: string]: AzureResourceSubscription[]} = {};

		const cache = this._cacheService.get<AzureResourceSelectedSubscriptionsCache>(AzureResourceSubscriptionFilterService.CacheKey);
		if (cache) {
			selectedSubscriptionsCache = cache.selectedSubscriptions;
		}

		if (!selectedSubscriptionsCache) {
			selectedSubscriptionsCache = {};
		}

		selectedSubscriptionsCache[account.key.accountId] = selectedSubscriptions;

		this._cacheService.update<AzureResourceSelectedSubscriptionsCache>(AzureResourceSubscriptionFilterService.CacheKey, { selectedSubscriptions: selectedSubscriptionsCache });

		const filters: string[] = [];
		for (const accountId in selectedSubscriptionsCache) {
			filters.push(...selectedSubscriptionsCache[accountId].map((subcription) => `${accountId}/${subcription.id}/${subcription.name}`));
		}

		const resourceFilterConfig = this._config.inspect<string[]>(AzureResourceSubscriptionFilterService.FilterConfigName);
		let configTarget = ConfigurationTarget.Global;
		if (resourceFilterConfig) {
			if (resourceFilterConfig.workspaceFolderValue) {
				configTarget = ConfigurationTarget.WorkspaceFolder;
			} else if (resourceFilterConfig.workspaceValue) {
				configTarget = ConfigurationTarget.Workspace;
			} else if (resourceFilterConfig.globalValue) {
				configTarget = ConfigurationTarget.Global;
			}
		}

		await this._config.update(AzureResourceSubscriptionFilterService.FilterConfigName, filters, configTarget);
	}

	private _config: WorkspaceConfiguration = undefined;
	private _cacheService: IAzureResourceCacheService = undefined;

	private static readonly FilterConfigName = 'resourceFilter';
	private static readonly CacheKey = 'azureResource.cache.selectedSubscriptions';
}

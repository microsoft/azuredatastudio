/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { SubscriptionClient } from '@azure/arm-subscriptions';

import { azureResource } from 'azureResource';
import { IAzureResourceSubscriptionService } from '../interfaces';
import { TokenCredentials } from '@azure/ms-rest-js';
import { AzureSubscriptionError } from '../errors';
import { AzureResourceErrorMessageUtil } from '../utils';

import * as nls from 'vscode-nls';
import { AzureAccount } from 'azurecore';
const localize = nls.loadMessageBundle();

export class AzureResourceSubscriptionService implements IAzureResourceSubscriptionService {
	/**
	 * Gets subscriptions for the given account. Any errors that occur while fetching the subscriptions for each tenant
	 * will be displayed to the user, but this function will only throw an error if it's unable to fetch any subscriptions.
	 * @param account The account to get the subscriptions for
	 * @param tenantIds The list of tenants to get subscriptions for - if undefined then subscriptions for all tenants will be retrieved
	 * @returns The list of all subscriptions on this account that were able to be retrieved
	 */
	public async getSubscriptions(account: AzureAccount, tenantIds?: string[]): Promise<azureResource.AzureResourceSubscription[]> {
		const subscriptions: azureResource.AzureResourceSubscription[] = [];
		let gotSubscriptions = false;
		const errors: Error[] = [];

		for (const tenantId of tenantIds ?? account.properties.tenants.map(t => t.id)) {
			try {
				const token = await azdata.accounts.getAccountSecurityToken(account, tenantId, azdata.AzureResource.ResourceManagement);
				const subClient = new SubscriptionClient(new TokenCredentials(token.token, token.tokenType), { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
				const newSubs = await subClient.subscriptions.list();
				subscriptions.push(...newSubs.map(newSub => {
					return {
						id: newSub.subscriptionId,
						name: newSub.displayName,
						tenant: tenantId
					};
				}));
				gotSubscriptions = true;
			} catch (error) {
				const errorMsg = localize('azure.resource.tenantSubscriptionsError', "Failed to get subscriptions for account {0} (tenant '{1}'). {2}", account.key.accountId, tenantId, AzureResourceErrorMessageUtil.getErrorMessage(error));
				console.warn(errorMsg);
				errors.push(error);
				vscode.window.showWarningMessage(errorMsg);
			}
		}
		if (!gotSubscriptions) {
			throw new AzureSubscriptionError(account.key.accountId, errors);
		}
		return subscriptions;
	}
}

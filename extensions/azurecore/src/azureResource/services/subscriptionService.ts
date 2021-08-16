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
	 * Gets all of the subscriptions for the specified account using the specified credential. This assumes that the credential passed is for
	 * the specified tenant - which the subscriptions returned will be associated with.
	 * @param account The account to get the subscriptions for
	 * @param credential The credential to use for querying the subscriptions
	 * @param tenantId The ID of the tenant these subscriptions are for
	 * @returns The list of all subscriptions on this account for the specified tenant
	 */
	public async getSubscriptions(account: azdata.Account, credential: any, tenantId: string): Promise<azureResource.AzureResourceSubscription[]> {
		const subscriptions: azureResource.AzureResourceSubscription[] = [];

		const subClient = new SubscriptionClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		const subs = await subClient.subscriptions.list();
		subs.forEach((sub) => subscriptions.push({
			id: sub.subscriptionId,
			name: sub.displayName,
			tenant: tenantId
		}));

		return subscriptions;
	}

	/**
	 * Gets all subscriptions for all tenants of the given account. Any errors that occur while fetching the subscriptions for each tenant
	 * will be displayed to the user, but this function will only throw an error if it's unable to fetch any subscriptions.
	 * @param account The account to get the subscriptions for
	 * @returns The list of all subscriptions on this account that were able to be retrieved
	 */
	public async getAllSubscriptions(account: AzureAccount): Promise<azureResource.AzureResourceSubscription[]> {
		const subscriptions: azureResource.AzureResourceSubscription[] = [];
		let gotSubscriptions = false;
		const errors: Error[] = [];

		for (const tenant of account.properties.tenants) {
			try {
				const token = await azdata.accounts.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.ResourceManagement);
				subscriptions.push(...(await this.getSubscriptions(account, new TokenCredentials(token.token, token.tokenType), tenant.id) || <azureResource.AzureResourceSubscription[]>[]));
				gotSubscriptions = true;
			} catch (error) {
				const errorMsg = localize('azure.resource.tenantSubscriptionsError', "Failed to get subscriptions for account {0} (tenant '{1}'). {2}", account.key.accountId, tenant.id, AzureResourceErrorMessageUtil.getErrorMessage(error));
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

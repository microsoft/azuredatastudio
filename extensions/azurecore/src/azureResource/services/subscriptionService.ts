/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { SubscriptionClient, SubscriptionClientOptionalParams } from '@azure/arm-subscriptions';
import { AzureAccount, azureResource } from 'azurecore';
import { IAzureResourceSubscriptionService } from '../interfaces';
import { AzureSubscriptionError } from '../errors';
import { AzureResourceErrorMessageUtil } from '../utils';
import { Logger } from '../../utils/Logger';

import * as nls from 'vscode-nls';
import { TenantIgnoredError } from '../../utils/TenantIgnoredError';
import { multiple_matching_tokens_error } from '../../constants';
import { TokenCredentialProvider } from './tokenCredentialProvider';
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
				if (token !== undefined) {
					let cred = new TokenCredentialProvider(account, tenantId);
					let params: SubscriptionClientOptionalParams = {
						endpoint: account.properties.providerSettings.settings.armResource.endpoint
					};
					const subClient: SubscriptionClient = new SubscriptionClient(cred, params);
					const newSubs = subClient.subscriptions.list();
					for await (const newSub of newSubs) {
						subscriptions.push({
							id: newSub.subscriptionId || '',
							name: newSub.displayName || '',
							tenant: tenantId
						});
					}
					Logger.verbose(`AzureResourceSubscriptionService.getSubscriptions: Retrieved ${subscriptions.length} subscriptions for tenant ${tenantId} / account ${account.displayInfo.displayName}`);
					gotSubscriptions = true;
				}
				else if (!account.isStale) {
					const errorMsg = localize('azure.resource.tenantTokenError', "Failed to acquire Access Token for account '{0}' (tenant '{1}').", account.displayInfo.displayName, tenantId);
					Logger.error(`Failed to acquire Access Token for account '${account.displayInfo.displayName}' (tenant '${tenantId}').`);
					void vscode.window.showWarningMessage(errorMsg);
				}
			} catch (error) {
				if (!account.isStale && !(error instanceof TenantIgnoredError)) {
					const msg = AzureResourceErrorMessageUtil.getErrorMessage(error);
					let errorMsg = localize('azure.resource.tenantSubscriptionsError', "Failed to get subscriptions for account {0} (tenant '{1}'). {2}", account.displayInfo.displayName, tenantId, msg);
					if (msg.includes(multiple_matching_tokens_error)) {
						errorMsg = errorMsg.concat(` To resolve this error, please clear token cache, and refresh account credentials.`);
					}
					Logger.error(`Failed to get subscriptions for account ${account.displayInfo.displayName} (tenant '${tenantId}'). ${msg}`);
					errors.push(error);
					void vscode.window.showWarningMessage(errorMsg);
				}
			}
		}
		if (!gotSubscriptions) {
			throw new AzureSubscriptionError(account.key.accountId, errors);
		}
		return subscriptions;
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Account } from 'azdata';
import { SubscriptionClient } from '@azure/arm-subscriptions';

import { azureResource } from '../azure-resource';
import { IAzureResourceSubscriptionService } from '../interfaces';

export class AzureResourceSubscriptionService implements IAzureResourceSubscriptionService {
	public async getSubscriptions(account: Account, credential: any, tenantId: string): Promise<azureResource.AzureResourceSubscription[]> {
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
}

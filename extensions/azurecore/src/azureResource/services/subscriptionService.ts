/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Account } from 'sqlops';
import { ServiceClientCredentials } from 'ms-rest';
import { SubscriptionClient } from 'azure-arm-resource';

import { IAzureResourceSubscriptionService } from '../interfaces';
import { AzureResourceSubscription } from '../models';

export class AzureResourceSubscriptionService implements IAzureResourceSubscriptionService {
	public async getSubscriptions(account: Account, credentials: ServiceClientCredentials[]): Promise<AzureResourceSubscription[]> {
		let subscriptions: AzureResourceSubscription[] = [];
		for (let cred of credentials) {
			let subClient = new SubscriptionClient.SubscriptionClient(cred);
			try {
				let subs = await subClient.subscriptions.list();
				subs.forEach((sub) => subscriptions.push({
					id: sub.subscriptionId,
					name: sub.displayName
				}));
			} catch (error) {
				// Swallow the exception here.
			}
		}

		return subscriptions;
	}
}

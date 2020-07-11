/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscriptionClient } from '@azure/arm-subscriptions';

import { azureResource } from '../azure-resource';
import { IAzureResourceTenantService } from '../interfaces';
import { Account } from 'azdata';

export class AzureResourceTenantService implements IAzureResourceTenantService {
	public async getTenantId(subscription: azureResource.AzureResourceSubscription, account: Account, credentials: any): Promise<string> {
		const subClient = new SubscriptionClient(credentials, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });

		const result = await subClient.subscriptions.get(subscription.id);
		return result.subscriptionId;
	}
}

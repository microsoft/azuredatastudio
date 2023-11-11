/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { queryGraphResources } from '../resourceTreeDataProviderBase';
import { sqlServerQuery, where } from '../queryStringConstants';
import { azureResource, AzureAccount } from 'azurecore';
import { DbServerGraphData, IAzureResourceServerService } from '../../interfaces';
import { DATABASE_SERVER_PROVIDER_ID } from '../../../constants';

export class AzureResourceDatabaseServerService implements IAzureResourceServerService<DbServerGraphData> {

	public queryFilter: string = sqlServerQuery;

	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResourceDatabaseServer[]> {
		const convertedResources: azureResource.AzureResourceDatabaseServer[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		let serverGraphResources: DbServerGraphData[] = await queryGraphResources<DbServerGraphData>(resourceClient, subscriptions, where + this.queryFilter);
		const ids = new Set<string>();
		serverGraphResources.forEach((res) => {
			if (!ids.has(res.id)) {
				ids.add(res.id);
				res.subscriptionName = subscriptions.find(sub => sub.id === res.subscriptionId)?.name;
				const converted = this.convertServerResource(res);
				convertedResources.push(converted!);
			}
		});

		return convertedResources;
	}

	public convertServerResource(resource: DbServerGraphData): azureResource.AzureResourceDatabaseServer | undefined {

		return {
			id: resource.id,
			name: resource.name,
			provider: DATABASE_SERVER_PROVIDER_ID,
			// Determine if resource object is for Synapse Workspace or not and get the needed property from the correct place.
			fullName: resource.properties.fullyQualifiedDomainName,
			loginName: resource.properties.administratorLogin,
			defaultDatabaseName: 'master',
			subscription: {
				id: resource.subscriptionId,
				name: resource.subscriptionName || ''
			},
			tenant: resource.tenantId,
			resourceGroup: resource.resourceGroup
		};
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { GraphData, queryGraphResources } from '../resourceTreeDataProviderBase';
import { sqlServerQuery } from '../queryStringConstants';
import { azureResource, AzureAccount } from 'azurecore';
import { IAzureResourceService } from '../../interfaces';

export interface DbServerGraphData extends GraphData {
	properties: {
		fullyQualifiedDomainName: string;
		administratorLogin: string;
	};
}

export class AzureResourceDatabaseServerService implements IAzureResourceService<azureResource.AzureResourceDatabaseServer> {

	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResourceDatabaseServer[]> {
		const convertedResources: azureResource.AzureResourceDatabaseServer[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		let serverGraphResources: DbServerGraphData[] = await queryGraphResources<DbServerGraphData>(resourceClient, subscriptions, sqlServerQuery);
		const ids = new Set<string>();
		serverGraphResources.forEach((res) => {
			if (!ids.has(res.id)) {
				ids.add(res.id);
				res.subscriptionName = subscriptions.find(sub => sub.id === res.subscriptionId)?.name;
				const converted = this.convertResource(res);
				convertedResources.push(converted);
			}
		});

		return convertedResources;
	}

	protected convertResource(resource: DbServerGraphData): azureResource.AzureResourceDatabaseServer {

		return {
			id: resource.id,
			name: resource.name,
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

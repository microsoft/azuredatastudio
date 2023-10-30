/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from '@azure/ms-rest-js';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { queryGraphResources } from '../resourceTreeDataProviderBase';
import { azureResource, AzureAccount } from 'azurecore';
import { IAzureResourceServerService, SynapseWorkspaceGraphData } from '../../interfaces';
import { synapseWorkspacesQuery, where } from '../queryStringConstants';
import { SYNAPSE_WORKSPACE_PROVIDER_ID } from '../../../constants';

export class AzureResourceSynapseWorkspaceService implements IAzureResourceServerService<SynapseWorkspaceGraphData> {

	public queryFilter: string = synapseWorkspacesQuery;

	public async getResources(subscriptions: azureResource.AzureResourceSubscription[], credential: ServiceClientCredentials, account: AzureAccount): Promise<azureResource.AzureResourceDatabaseServer[]> {
		const convertedResources: azureResource.AzureResourceDatabaseServer[] = [];
		const resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		let serverGraphResources: SynapseWorkspaceGraphData[] = await queryGraphResources<SynapseWorkspaceGraphData>(resourceClient, subscriptions, where + this.queryFilter);
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

	public convertServerResource(resource: SynapseWorkspaceGraphData): azureResource.AzureResourceDatabaseServer | undefined {

		return {
			id: resource.id,
			name: resource.name,
			provider: SYNAPSE_WORKSPACE_PROVIDER_ID,
			fullName: resource.properties.connectivityEndpoints?.sql,
			loginName: resource.properties.sqlAdministratorLogin,
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

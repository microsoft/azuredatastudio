/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials } from 'ms-rest';
// TODO: Use right API for Arcadia
//import { SqlManagementClient } from 'azure-arm-sql';

import { azureResource } from '../../azure-resource';
import { IAzureResourceAzureDataExplorerService } from './interfaces';
import { AzureResourceAzureDataExplorer } from './models';
import { ResourceManagementClient } from 'azure-arm-resource';

let resourceTypeFilter: string[] = [
	"Microsoft.Kusto/clusters"
];

export class AzureResourceAzureDataExplorerService implements IAzureResourceAzureDataExplorerService {
	public async getAzureDataExplorers(subscription: azureResource.AzureResourceSubscription, credential: ServiceClientCredentials): Promise<AzureResourceAzureDataExplorer[]> {
		const azureDataExplorers: AzureResourceAzureDataExplorer[] = [];

		const resClient = new ResourceManagementClient.ResourceManagementClient(credential, subscription.id);
		const resources = await resClient.resources.list();
		resources.forEach((resource) => {
			if(resource.type === resourceTypeFilter[0])
			{
				azureDataExplorers.push({
				id: resource.id,
				name: resource.name,
				type:resource.type,
				location: resource.location});
			}
		});

		// TODO: Use ARM calls
		/*const sqlManagementClient = new SqlManagementClient(credential, subscription.id);
		const svrs = await sqlManagementClient.servers.list();

		svrs.forEach((svr) => databaseServers.push({
			name: svr.name,
			fullName: svr.fullyQualifiedDomainName,
			loginName: svr.administratorLogin,
			defaultDatabaseName: 'master'
		}));*/

		return azureDataExplorers;
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials } from 'ms-rest';
import { SqlManagementClient } from 'azure-arm-sql';

import { azureResource } from '../../azure-resource';
import { IAzureResourceDatabaseServerService } from './interfaces';
import { AzureResourceDatabaseServer } from './models';

export class AzureResourceDatabaseServerService implements IAzureResourceDatabaseServerService {
	public async getDatabaseServers(subscription: azureResource.AzureResourceSubscription, credential: ServiceClientCredentials): Promise<AzureResourceDatabaseServer[]> {
		const databaseServers: AzureResourceDatabaseServer[] = [];

		const sqlManagementClient = new SqlManagementClient(credential, subscription.id);
		const svrs = await sqlManagementClient.servers.list();

		svrs.forEach((svr) => databaseServers.push({
			name: svr.name,
			 fullName: svr.fullyQualifiedDomainName,
			 loginName: svr.administratorLogin,
			 defaultDatabaseName: 'master'
		}));

		return databaseServers;
	}
}

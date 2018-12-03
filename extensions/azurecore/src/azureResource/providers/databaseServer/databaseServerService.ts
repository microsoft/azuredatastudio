/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { azureResource } from 'sqlops';
import { ServiceClientCredentials } from 'ms-rest';
import { SqlManagementClient } from 'azure-arm-sql';

import { IAzureResourceDatabaseServerService } from './interfaces';
import { AzureResourceDatabaseServer } from './models';

export class AzureResourceDatabaseServerService implements IAzureResourceDatabaseServerService {
	public getDatabaseServers(subscription: azureResource.AzureResourceSubscription, credential: ServiceClientCredentials): Promise<AzureResourceDatabaseServer[]> {
		return new Promise<AzureResourceDatabaseServer[]>((resolve, reject) => {
			const sqlManagementClient = new SqlManagementClient(credential, subscription.id);
			sqlManagementClient.servers.list().then((svrs) => {
				const databaseServers: AzureResourceDatabaseServer[] = [];

				// svrs.forEach((svr) => databaseServers.push({
				// 	name: svr.name,
				// 	fullName: svr.fullyQualifiedDomainName,
				// 	loginName: svr.administratorLogin,
				// 	defaultDatabaseName: 'master'
				// }));

				resolve(databaseServers);
			});
		});
	}
}

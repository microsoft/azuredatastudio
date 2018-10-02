/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials } from 'ms-rest';
import { SqlManagementClient } from 'azure-arm-sql';

import { IAzureResourceDatabaseServerService } from '../interfaces';
import { AzureResourceSubscription, AzureResourceDatabaseServer } from '../models';

export class AzureResourceDatabaseServerService implements IAzureResourceDatabaseServerService {
	public async getDatabaseServers(subscription: AzureResourceSubscription, credentials: ServiceClientCredentials[]): Promise<AzureResourceDatabaseServer[]> {
		let databaseServers: AzureResourceDatabaseServer[] = [];
		for (let cred of credentials) {
			let sqlManagementClient = new SqlManagementClient(cred, subscription.id);
			try {
				let svrs = await sqlManagementClient.servers.list();
				svrs.forEach((svr) => databaseServers.push({
					name: svr.name,
					fullName: svr.fullyQualifiedDomainName,
					loginName: svr.administratorLogin,
					defaultDatabaseName: 'master'
				}));
			} catch (error) {
				if (error.code === 'InvalidAuthenticationTokenTenant' && error.statusCode === 401) {
					/**
					 * There may be multiple tenants for an account and it may throw exceptions like following. Just swallow the exception here.
					 *   The access token is from the wrong issuer. It must match one of the tenants associated with this subscription.
					 */
				}
			}
		}

		return databaseServers;
	}
}

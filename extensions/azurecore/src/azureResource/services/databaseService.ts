/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials } from 'ms-rest';
import { SqlManagementClient } from 'azure-arm-sql';

import { IAzureResourceDatabaseService } from '../interfaces';
import { AzureResourceSubscription, AzureResourceDatabase } from '../models';

export class AzureResourceDatabaseService implements IAzureResourceDatabaseService {
	public async getDatabases(subscription: AzureResourceSubscription, credentials: ServiceClientCredentials[]): Promise<AzureResourceDatabase[]> {
		let databases: AzureResourceDatabase[] = [];
		for (let cred of credentials) {
			let sqlManagementClient = new SqlManagementClient(cred, subscription.id);
			try {
				let svrs = await sqlManagementClient.servers.list();
				for (let svr of svrs) {
					// Extract resource group name from svr.id
					let svrIdRegExp = new RegExp(`\/subscriptions\/${subscription.id}\/resourceGroups\/(.+)\/providers\/Microsoft\.Sql\/servers\/${svr.name}`);
					if (!svrIdRegExp.test(svr.id)) {
						continue;
					}

					let founds = svrIdRegExp.exec(svr.id);
					let resouceGroup = founds[1];

					let dbs = await sqlManagementClient.databases.listByServer(resouceGroup, svr.name);
					dbs.forEach((db) => databases.push({
						name: db.name,
						serverName: svr.name,
						serverFullName: svr.fullyQualifiedDomainName,
						loginName: svr.administratorLogin
					}));
				}
			} catch (error) {
				if (error.code === 'InvalidAuthenticationTokenTenant' && error.statusCode === 401) {
					/**
					 * There may be multiple tenants for an account and it may throw exceptions like following. Just swallow the exception here.
					 *   The access token is from the wrong issuer. It must match one of the tenants associated with this subscription.
					 */
				}
			}
		}

		return databases;
	}
}

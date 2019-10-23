/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClientCredentials } from 'ms-rest';
import { SqlManagementClient } from 'azure-arm-sql';

import { azureResource } from '../../azure-resource';
import { IAzureResourceService, AzureResourceDatabase } from '../../interfaces';

export class AzureResourceDatabaseService implements IAzureResourceService<AzureResourceDatabase> {
	public async getResources(subscription: azureResource.AzureResourceSubscription, credential: ServiceClientCredentials): Promise<AzureResourceDatabase[]> {
		const databases: AzureResourceDatabase[] = [];
		const sqlManagementClient = new SqlManagementClient(credential, subscription.id);
		const svrs = await sqlManagementClient.servers.list();
		for (const svr of svrs) {
			// Extract resource group name from svr.id
			const svrIdRegExp = new RegExp(`\/subscriptions\/${subscription.id}\/resourceGroups\/(.+)\/providers\/Microsoft\.Sql\/servers\/${svr.name}`);
			if (!svrIdRegExp.test(svr.id)) {
				continue;
			}

			const founds = svrIdRegExp.exec(svr.id);
			const resouceGroup = founds[1];

			const dbs = await sqlManagementClient.databases.listByServer(resouceGroup, svr.name);
			dbs.forEach((db) => databases.push({
				name: db.name,
				serverName: svr.name,
				serverFullName: svr.fullyQualifiedDomainName,
				loginName: svr.administratorLogin
			}));
		}

		return databases;
	}
}

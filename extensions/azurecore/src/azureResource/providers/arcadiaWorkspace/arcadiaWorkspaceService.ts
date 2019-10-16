/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials } from 'ms-rest';
// TODO: Use right API for Arcadia
//import { SqlManagementClient } from 'azure-arm-sql';

import { azureResource } from '../../azure-resource';
import { IAzureResourceArcadiaWorkspaceService } from './interfaces';
import { AzureResourceArcadiaWorkspace } from './models';

export class AzureResourceArcadiaWorkspaceService implements IAzureResourceArcadiaWorkspaceService {
	public async getArcadiaWorkspaces(subscription: azureResource.AzureResourceSubscription, credential: ServiceClientCredentials): Promise<AzureResourceArcadiaWorkspace[]> {
		const arcadiaWorkspaces: AzureResourceArcadiaWorkspace[] = [];

		// TODO: Use ARM calls
		/*const sqlManagementClient = new SqlManagementClient(credential, subscription.id);
		const svrs = await sqlManagementClient.servers.list();

		svrs.forEach((svr) => databaseServers.push({
			name: svr.name,
			fullName: svr.fullyQualifiedDomainName,
			loginName: svr.administratorLogin,
			defaultDatabaseName: 'master'
		}));*/

		return arcadiaWorkspaces;
	}
}

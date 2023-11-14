/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';
import { sqlInstanceQuery } from '../queryStringConstants';
import { ResourceServiceBase } from '../resourceTreeDataProviderBase';
import { SqlInstanceGraphData } from '../../interfaces';
import { SQLINSTANCE_PROVIDER_ID } from '../../../constants';

export class SqlInstanceResourceService extends ResourceServiceBase<SqlInstanceGraphData> {

	public override queryFilter: string = sqlInstanceQuery;

	public override convertServerResource(resource: SqlInstanceGraphData): azureResource.AzureResourceDatabaseServer | undefined {
		return {
			id: resource.id,
			name: resource.name,
			provider: SQLINSTANCE_PROVIDER_ID,
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

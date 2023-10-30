/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceServiceBase } from '../resourceTreeDataProviderBase';
import { azureResource } from 'azurecore';
import { sqlInstanceArcQuery } from '../queryStringConstants';
import { SqlInstanceArcGraphData } from '../../interfaces';
import { SQLINSTANCE_ARC_PROVIDER_ID } from '../../../constants';

export class SqlInstanceArcResourceService extends ResourceServiceBase<SqlInstanceArcGraphData> {

	public override queryFilter: string = sqlInstanceArcQuery;

	public override convertServerResource(resource: SqlInstanceArcGraphData): azureResource.AzureResourceDatabaseServer | undefined {
		return {
			id: resource.id,
			name: resource.name,
			provider: SQLINSTANCE_ARC_PROVIDER_ID,
			fullName: resource.name,
			loginName: resource.properties.admin,
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

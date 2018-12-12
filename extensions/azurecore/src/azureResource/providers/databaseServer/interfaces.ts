/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials }  from 'ms-rest';

import { azureResource } from '../../azure-resource';
import { AzureResourceDatabaseServer } from './models';

export interface IAzureResourceDatabaseServerService {
	getDatabaseServers(subscription: azureResource.AzureResourceSubscription, credentials: ServiceClientCredentials): Promise<AzureResourceDatabaseServer[]>;
}

export interface IAzureResourceDatabaseServerNode extends azureResource.IAzureResourceNode {
	readonly databaseServer: AzureResourceDatabaseServer;
}
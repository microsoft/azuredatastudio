/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials } from 'ms-rest';

import { azureResource } from '../../azure-resource';
import { AzureResourceDatabase } from './models';

export interface IAzureResourceDatabaseService {
	getDatabases(subscription: azureResource.AzureResourceSubscription, credential: ServiceClientCredentials): Promise<AzureResourceDatabase[]>;
}

export interface IAzureResourceDatabaseNode extends azureResource.IAzureResourceNode {
	readonly database: AzureResourceDatabase;
}
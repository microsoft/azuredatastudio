/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials } from 'ms-rest';

import { azureResource } from '../../azure-resource';
import { AzureResourceAzureDataExplorer } from './models';

export interface IAzureResourceAzureDataExplorerService {
	getAzureDataExplorers(subscription: azureResource.AzureResourceSubscription, credentials: ServiceClientCredentials): Promise<AzureResourceAzureDataExplorer[]>;
}

export interface IAzureResourceAzureDataExplorerNode extends azureResource.IAzureResourceNode {
	readonly azureDataExplorer: AzureResourceAzureDataExplorer;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ServiceClientCredentials } from 'ms-rest';

import { azureResource } from '../../azure-resource';
import { AzureResourceArcadiaWorkspace } from './models';

export interface IAzureResourceArcadiaWorkspaceService {
	getArcadiaWorkspaces(subscription: azureResource.AzureResourceSubscription, credentials: ServiceClientCredentials): Promise<AzureResourceArcadiaWorkspace[]>;
}

export interface IAzureResourceArcadiaWorkspaceNode extends azureResource.IAzureResourceNode {
	readonly arcadiaWorkspace: AzureResourceArcadiaWorkspace;
}

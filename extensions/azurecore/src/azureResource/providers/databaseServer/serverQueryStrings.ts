/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';

export const synapseQuery = `where type == "microsoft.synapse/workspaces"`;

export const serversQuery = `where type == "${azureResource.AzureResourceType.sqlServer}" and kind != "v12.0,analytics"`;

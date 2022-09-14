/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azureResource } from 'azurecore';

export const synapseWorkspacesQuery = `where type == "microsoft.synapse/workspaces"`;

// Lists all Sql Servers except for Synapse Pool Servers (they have different properties and need to be handled separately)
export const sqlServersQuery = `where type == "${azureResource.AzureResourceType.sqlServer}" and kind != "v12.0,analytics"`;

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// General Constants ///////////////////////////////////////////////////////

export const SqlServerName = localize('sqlServerTypeName', 'SQL Server');

export const msgMissingNodeContext = localize('msgMissingNodeContext', 'Node Command called without any node passed');
// External Table
export const sourceSchemaTitle = localize('externalTable.sourceSchemaTitle', "Source Schema");
export const sourceTableTitle = localize('externalTable.sourceTableTitle', "Source Table");
export const externalSchemaTitle = localize('externalTable.externalSchemaTitle', "External Schema");
export const externalTableTitle = localize('externalTable.externalTableTitle', "External Table");
export const serverNameTitle = localize('externalTable.serverNameTitle', "Server Name");
export const hostnameTitle = localize('externalTable.hostnameTitle', "Hostname");
export const databaseNameTitle = localize('externalTable.databaseNameTitle', "Database Name");
export const serviceNameTitle = localize('externalTable.serviceNameTitle', "Service name / SID");

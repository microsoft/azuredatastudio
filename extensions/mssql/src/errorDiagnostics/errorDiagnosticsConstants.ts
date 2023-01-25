/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// Error code reference comes from here: https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/database-engine-events-and-errors?view=sql-server-ver16
export const MssqlPasswordResetErrorCode: number = 18488;

export const MssqlDiagnosticsProviderDisplayName = localize('mssql.diagnosticsProviderDisplayName', "Azure SQL Diagnostics for MSSQL");

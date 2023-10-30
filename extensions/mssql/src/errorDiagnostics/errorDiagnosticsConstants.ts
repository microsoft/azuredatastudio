/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// Error code reference comes from here: https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/database-engine-events-and-errors?view=sql-server-ver16
export const MssqlPasswordResetErrorCode: number[] = [18488, 18487];

export const MssqlCertValidationFailedErrorCode: number = -2146893019;

export const MssqlConnectionTelemetryView = 'MssqlConnectionErrorDialog';
export const ConnectionErrorDialogTitle = localize('connectionError', "Connection error");

// Trust Server certificate custom dialog constants.
export const TSC_ActionId = 'enableTrustServerCertificate';
export const TSC_OptionName = 'trustServerCertificate';
export const TSC_EnableTrustServerCert = localize('enableTrustServerCertificate', "Enable Trust server certificate");
export const TSC_InstructionText = localize('trustServerCertInstructionText', `Encryption was enabled on this connection, review your SSL and certificate configuration for the target SQL Server, or enable 'Trust server certificate' in the connection dialog.

Note: A self-signed certificate offers only limited protection and is not a recommended practice for production environments. Do you want to enable 'Trust server certificate' on this connection and retry? `);
export const TSC_ReadMoreLink = "https://learn.microsoft.com/sql/database-engine/configure-windows/enable-encrypted-connections-to-the-database-engine"

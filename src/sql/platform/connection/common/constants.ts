/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// constants
export const sqlConfigSectionName = 'sql';
export const outputChannelName = 'MSSQL';

/* Memento constants */
export const capabilitiesOptions = 'OPTIONS_METADATA';

export const mssqlProviderName = 'MSSQL';
export const pgsqlProviderName = 'PGSQL';
export const anyProviderName = '*';
export const connectionProviderContextKey = 'connectionProvider';

export const applicationName = 'azdata';

export const defaultEngine = 'defaultEngine';

export const passwordChars = '***************';

/* default authentication type setting name*/
export const defaultAuthenticationType = 'defaultAuthenticationType';

export enum AuthenticationType {
	SqlLogin = 'SqlLogin',
	Integrated = 'Integrated',
	AzureMFA = 'AzureMFA',
	AzureMFAAndUser = 'AzureMFAAndUser',
	DSTSAuth = 'dstsAuth',
	None = 'None'
}

/* CMS constants */
export const cmsProviderName = 'MSSQL-CMS';

export const UNSAVED_GROUP_ID = 'unsaved';

/* Server Type Constants */
export const sqlDataWarehouse = 'Azure SQL Data Warehouse';
export const gen3Version = 12;

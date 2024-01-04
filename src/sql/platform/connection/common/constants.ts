/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// constants
export const sqlConfigSectionName = 'sql';
export const outputChannelName = 'MSSQL';

/* Memento constants */
export const capabilitiesOptions = 'OPTIONS_METADATA';

export const mssqlProviderName = 'MSSQL';
export const mssqlCmsProviderName = 'MSSQL-CMS';
export const mysqlProviderName = 'MYSQL';
export const pgsqlProviderName = 'PGSQL';
export const anyProviderName = '*';
export const connectionProviderContextKey = 'connectionProvider';

export const applicationName = 'azdata';
export const mssqlApplicationNameOption = 'applicationName';

export const defaultEngine = 'defaultEngine';

export const passwordChars = '***************';

export const enableSqlAuthenticationProviderConfig = 'mssql.enableSqlAuthenticationProvider';


/* default authentication type setting name*/
export const defaultAuthenticationType = 'defaultAuthenticationType';

/* Connection Properties */
export const trustServerCertificate = 'trustServerCertificate';

/**
 * Well-known Authentication types commonly supported by connection providers.
 */
export enum AuthenticationType {
	/**
	 * Username and password
	 */
	SqlLogin = 'SqlLogin',
	/**
	 * Windows Authentication
	 */
	Integrated = 'Integrated',
	/**
	 * Microsoft Entra ID - Universal with MFA support
	 */
	AzureMFA = 'AzureMFA',
	/**
	 * Microsoft Entra ID - Password
	 */
	AzureMFAAndUser = 'AzureMFAAndUser',
	/**
	 * Datacenter Security Token Service Authentication
	 */
	DSTSAuth = 'dstsAuth',
	/**
	 * No authentication required
	 */
	None = 'None'
}

/*
* Actions for the connection dialog to show/hide connection options.
*/
export enum Actions {
	/**
	 * Shows a connection option
	 */
	Show = 'show',
	/**
	 * Hides a connection option
	 */
	Hide = 'hide'
}

/* CMS constants */
export const cmsProviderName = 'MSSQL-CMS';

export const UNSAVED_GROUP_ID = 'unsaved';

/* Server Type Constants */
export const sqlDataWarehouse = 'Azure SQL Data Warehouse';
export const gen3Version = 12;

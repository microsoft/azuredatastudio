/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

const mssqlExtensionConfigName = 'mssql';
const enableSqlAuthenticationProviderConfig = 'enableSqlAuthenticationProvider';

const azureExtensionConfigName = 'azure';
const azureAuthenticationLibraryConfig = 'authenticationLibrary';
const MSAL = 'MSAL';

/**
 * @returns 'True' if MSAL auth library is in use and SQL Auth provider is enabled.
 */
export function isMssqlAuthProviderEnabled(): boolean {
	return getAzureAuthenticationLibraryConfig() === MSAL && getEnableSqlAuthenticationProviderConfig();
}

export function getConfiguration(config: string): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(config);
}

/**
 * Reads setting 'azure.AuthenticationLibrary' and returns the library name enabled.
 * @returns MSAL | ADAL
 */
export function getAzureAuthenticationLibraryConfig(): string {
	const config = getConfiguration(azureExtensionConfigName);
	if (config) {
		return config.get<string>(azureAuthenticationLibraryConfig, MSAL); // default Auth library
	}
	else {
		return MSAL; // default Auth library
	}
}

/**
 * Reads setting 'mssql.enableSqlAuthenticationProvider' and returns true if it's enabled.
 * @returns True Sql Auth provider is enabled for MSSQL provider.
 */
export function getEnableSqlAuthenticationProviderConfig(): boolean {
	const config = getConfiguration(mssqlExtensionConfigName);
	if (config) {
		return config.get<boolean>(enableSqlAuthenticationProviderConfig, true); // enabled by default
	}
	else {
		return true; // enabled by default
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

const mssqlExtensionConfigName = 'mssql';
const enableSqlAuthenticationProviderConfig = 'enableSqlAuthenticationProvider';

/**
 * @returns 'True' if SQL Auth provider is enabled.
 */
export function isMssqlAuthProviderEnabled(): boolean {
	return getEnableSqlAuthenticationProviderConfig();
}

export function getConfiguration(config: string): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(config);
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

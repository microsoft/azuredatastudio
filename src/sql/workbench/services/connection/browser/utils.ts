/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { azureAuthenticationLibraryConfig, enableSqlAuthenticationProviderConfig, mssqlProviderName } from 'sql/platform/connection/common/constants';
import { MSAL_AUTH_LIBRARY } from 'sql/workbench/services/accountManagement/common/utils';

/**
 * Reads setting 'mssql.enableSqlAuthenticationProvider' returns true if it's enabled.
 * Returns false for other providers.
 * @param provider Connection provider name
 * @param configService Configuration service instance
 * @returns True if provider is MSSQL and Sql Auth provider is enabled.
 */
export function isMssqlAuthProviderEnabled(provider: string, configService: IConfigurationService | undefined): boolean {
	return provider === mssqlProviderName && isMSALAuthLibraryEnabled(configService) && (configService?.getValue(enableSqlAuthenticationProviderConfig) ?? true);
}

/**
 * We need Azure core extension configuration for fetching Authentication Library setting in use.
 * This is required for 'enableSqlAuthenticationProvider' to be enabled (as it applies to MSAL only).
 * This can be removed in future when ADAL support is dropped.
 * @param configService Configuration Service to use.
 * @returns true if MSAL_AUTH_LIBRARY is enabled.
 */
export function isMSALAuthLibraryEnabled(configService: IConfigurationService | undefined): boolean {
	return configService?.getValue(azureAuthenticationLibraryConfig) === MSAL_AUTH_LIBRARY /*default*/ ?? true;
}

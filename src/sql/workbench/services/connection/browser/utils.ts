/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { enableSqlAuthenticationProviderConfig, mssqlProviderName } from 'sql/platform/connection/common/constants';

/**
 * Reads setting 'mssql.enableSqlAuthenticationProvider' returns true if it's enabled.
 * Returns false for other providers.
 * @param provider Connection provider name
 * @param configService Configuration service instance
 * @returns True if provider is MSSQL and Sql Auth provider is enabled.
 */
export function isMssqlAuthProviderEnabled(provider: string, configService: IConfigurationService | undefined): boolean {
	return provider === mssqlProviderName && (configService?.getValue(enableSqlAuthenticationProviderConfig) ?? true);
}

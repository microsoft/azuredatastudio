/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

export const AZURE_AUTH_LIBRARY_CONFIG = 'azure.authenticationLibrary';

export type AuthLibrary = 'ADAL' | 'MSAL';
export const MSAL_AUTH_LIBRARY: AuthLibrary = 'MSAL';
export const ADAL_AUTH_LIBRARY: AuthLibrary = 'ADAL';

export const DEFAULT_AUTH_LIBRARY: AuthLibrary = MSAL_AUTH_LIBRARY;

export function getAuthLibrary(configurationService: IConfigurationService): AuthLibrary {
	return configurationService.getValue(AZURE_AUTH_LIBRARY_CONFIG) || DEFAULT_AUTH_LIBRARY;
}

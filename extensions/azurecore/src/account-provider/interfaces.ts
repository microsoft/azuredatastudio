/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azurecore from 'azurecore';

/**
 * Mapping of configuration key with the metadata to instantiate the account provider
 */
export interface ProviderSettings {
	/**
	 * Key for configuration regarding whether the account provider is enabled
	 */
	configKey: string;

	/**
	 * Metadata for the provider
	 */
	metadata: azurecore.AzureAccountProviderMetadata;
}

export interface Subscription {
	id: string,
	tenantId: string,
	displayName: string
}

/**
 * Token returned from a request for an access token
 */
export interface AzureAccountSecurityToken {
	/**
	 * Access token, itself
	 */
	token: string;

	/**
	 * Date that the token expires on
	 */
	expiresOn: Date | string;

	/**
	 * Name of the resource the token is good for (ie, management.core.windows.net)
	 */
	resource: string;

	/**
	 * Type of the token (pretty much always 'Bearer')
	 */
	tokenType: string;
}

/**
 * Azure account security token maps a tenant ID to the information returned from a request to get
 * an access token. The list of tenants correspond to the tenants in the account properties.
 */
export type AzureAccountSecurityTokenCollection = { [tenantId: string]: AzureAccountSecurityToken };

export interface Deferred<T, E extends Error = Error> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: E) => void;
}

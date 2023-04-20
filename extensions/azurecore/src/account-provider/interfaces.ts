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

export interface Deferred<T, E extends Error = Error> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: E) => void;
}

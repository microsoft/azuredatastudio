/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azurecore from 'azurecore';

export const enum SettingIds {
	marm = 'marm',
	msgraph = 'msgraph',
	arm = 'arm',
	sql = 'sql',
	ossrdbms = 'ossrdbms',
	vault = 'vault',
	ado = 'ado',
	ala = 'ala',
	storage = 'storage',
	kusto = 'kusto',
	powerbi = 'powerbi'
}

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

/**
 * Custom Provider settings mapping
 */
export type ProviderSettingsJson = {
	name: string,
	settings: {
		configKey: string,
		metadata: {
			displayName: string,
			id: string,
			endpoints: {
				host: string,
				clientId: string,
				microsoftResource: string,
				msGraphResource?: string,
				armResource: string,
				sqlResource: string,
				azureKeyVaultResource: string,
				azureLogAnalyticsResource?: string,
				azureStorageResource: {
					endpoint: string,
					endpointSuffix: string
				}
				azureKustoResource?: string,
				powerBiResource?: string,
				scopes: string,
				portalEndpoint?: string
			}
		}
	}
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

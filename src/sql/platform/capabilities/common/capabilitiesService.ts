/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import type { IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { IconPath } from 'sql/platform/connection/common/connectionProfile';

export const SERVICE_ID = 'capabilitiesService';
export const HOST_NAME = 'azdata';
export const HOST_VERSION = '1.0';

export const clientCapabilities = {
	hostName: HOST_NAME,
	hostVersion: HOST_VERSION
};

/**
 * The map containing the connection provider names and the owning extensions.
 * This is to workaround the issue that we don't have the ability to store and query the information from extension gallery.
 * IMPORTANT : Every extension in this list is assumed to be directly installable (not 3rd party). If that changes then
 * 			handleUnsupportedProvider needs to be updated to handle those cases.
 */
export const ConnectionProviderAndExtensionMap = new Map<string, string>([
	['PGSQL', 'microsoft.azuredatastudio-postgresql'],
	['KUSTO', 'microsoft.kusto'],
	['LOGANALYTICS', 'microsoft.azuremonitor'],
	['COSMOSDB_MONGO', 'microsoft.azure-cosmosdb-ads-extension'],
	['COSMOSDB_NOSQL', 'microsoft.azure-cosmosdb-ads-extension'],
	['MySQL', 'microsoft.azuredatastudio-mysql']
]);

/**
 * The connection string options for connection provider.
 */
export interface ConnectionStringOptions {
	/**
	 * Whether the connection provider supports connection string as an input option. The default value is false.
	 */
	isEnabled?: boolean;
	/**
	 * Whether the connection provider uses connection string as the default option to connect. The default value is false.
	 */
	isDefault?: boolean;
}

/**
 * The connection provider properties.
 */
export interface ConnectionProviderProperties {
	/**
	 * The connection provider id, e.g. MSSQL, LOGANALYTICS
	 */
	providerId: string;

	/**
	 * Path to the connection provider's icon
	 */
	iconPath?: URI | IconPath | { id: string, path: IconPath, default?: boolean }[]

	/**
	 * The display name of the connection provider, e.g. Microsoft SQL Server, Azure Monitor Logs
	 */
	displayName: string;

	/**
	 * Enable to use all connection properties for URI generation (ServiceLayer requires the same options as well.)
	 * If not specified, only IsIdentity options will be used instead (URI with basic info).
	 */
	useFullOptions?: boolean;

	/**
	 * Alias to be used for the kernel in notebooks
	 */
	notebookKernelAlias?: string;

	/**
	 * Azure resource endpoint to be used by the connection provider.
	 *
	 * Accepted values are determined from azdata.AzureResource enum:
	 * ResourceManagement, Sql, OssRdbms, AzureKeyVault, Graph, MicrosoftResourceManagement,
	 * AzureDevOps, MsGraph, AzureLogAnalytics, AzureStorage, AzureKusto, PowerBi
	 *
	 * Defaults to 'Sql' if not specified.
	 */
	azureResource?: string;

	/**
	 * List of all connection properties for the connection provider.
	 */
	connectionOptions: azdata.ConnectionOption[];

	/**
	 * Boolean indicating whether the connection provider supports queries.
	 * The default value is true.
	 */
	isQueryProvider?: boolean;

	/**
	 * Boolean indicating whether the connection provider supports execution plan.
	 */
	isExecutionPlanProvider?: boolean;

	/**
	 * List of file extensions supported by the execution plan provider, if execution plan is supported.
	 */
	supportedExecutionPlanFileExtensions?: string[];

	/**
	 * Connection string options for the connection provider
	 */
	connectionStringOptions?: ConnectionStringOptions;

	/**
	 * Indicates whether the provider support copy results to clipboard. Default value is false.
	 * If true, the copy results to clipboard will be delegated to the provider to avoid passing large amount of data using the RPC channel.
	 * Otherwise ADS will handle the copy request on the UI side.
	 */
	supportCopyResultsToClipboard?: boolean;
}

export interface ProviderFeatures {
	connection: ConnectionProviderProperties;
}


export const ICapabilitiesService = createDecorator<ICapabilitiesService>(SERVICE_ID);

/**
 * Interface for managing provider capabilities
 */
export interface ICapabilitiesService {
	_serviceBrand: undefined;

	/**
	 * Retrieve a list of registered capabilities providers
	 */
	getCapabilities(provider: string): ProviderFeatures | undefined;

	/**
	 * get the old version of provider information
	 */
	getLegacyCapabilities(provider: string): azdata.DataProtocolServerCapabilities | undefined;

	/**
	 * Register a capabilities provider
	 */
	registerProvider(provider: azdata.CapabilitiesProvider): void;

	/**
	 * When new capabilities are registered, it emits the @see ProviderFeatures, which can be used to get the new capabilities
	 */
	readonly onCapabilitiesRegistered: Event<{ id: string; features: ProviderFeatures }>;

	/**
	 * Get an array of all known providers
	 */
	readonly providers: { [id: string]: ProviderFeatures };

	registerConnectionProvider(id: string, properties: ConnectionProviderProperties): IDisposable;

}

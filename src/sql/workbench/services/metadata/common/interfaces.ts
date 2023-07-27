/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';


export const SERVICE_ID = 'allServerMetadataService';
export const IAllServerMetadataService = createDecorator<IAllServerMetadataService>(SERVICE_ID);

export interface IAllServerMetadataService {
	_serviceBrand: undefined;

	/**
	 * Register an all server metadata service provider
	 */
	registerProvider(providerId: string, provider: azdata.metadata.AllServerMetadataProvider): void;

	/**
	 * Unregister an all server metadata service provider
	 */
	unregisterProvider(providerId: string): void;

	/**
	 * Gets a registered all server metadata service provider. An exception is thrown if a provider isn't registered with the specified ID
	 * @param providerId The ID of the registered provider
	 */
	getProvider(providerId: string): azdata.metadata.AllServerMetadataProvider;

	/**
	 * Gets all database server metadata in the form of create table scripts for all tables
	 * @param providerName The name of the provider to get metadata for
	 * @param ownerUri The URI of the connection to get metadata for
	 */
	getAllServerMetadata(providerName: string, ownerUri: string): Promise<azdata.metadata.AllServerMetadataResult>;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';


export const SERVICE_ID = 'serverMetadataService';
export const IServerMetadataService = createDecorator<IServerMetadataService>(SERVICE_ID);

export interface IServerMetadataService {
	_serviceBrand: undefined;

	/**
	 * Register an all server metadata service provider
	 */
	registerProvider(providerId: string, provider: azdata.metadata.ServerMetadataProvider): void;

	/**
	 * Unregister an all server metadata service provider
	 */
	unregisterProvider(providerId: string): void;

	/**
	 * Gets a registered all server metadata service provider. An exception is thrown if a provider isn't registered with the specified ID
	 * @param providerId The ID of the registered provider
	 */
	getProvider(providerId: string): azdata.metadata.ServerMetadataProvider;

	/**
	 * Generates all database server metadata in the form of create table scripts for all tables
	 * @param ownerUri The URI of the connection to get metadata for
	 */
	generateServerMetadata(ownerUri: string): Promise<azdata.metadata.GenerateServerMetadataResult>;
}

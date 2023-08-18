/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';


export const SERVICE_ID = 'databaseServerContextualizationService';
export const IDatabaseServerContextualizationService = createDecorator<IDatabaseServerContextualizationService>(SERVICE_ID);

export interface IDatabaseServerContextualizationService {
	_serviceBrand: undefined;

	/**
	 * Register a database server contextualization service provider
	 */
	registerProvider(providerId: string, provider: azdata.contextualization.DatabaseServerContextualizationProvider): void;

	/**
	 * Unregister a database server contextualization service provider
	 */
	unregisterProvider(providerId: string): void;

	/**
	 * Gets a registered database server contextualization service provider. An exception is thrown if a provider isn't registered with the specified ID
	 * @param providerId The ID of the registered provider
	 */
	getProvider(providerId: string): azdata.contextualization.DatabaseServerContextualizationProvider;

	/**
	 * Generates all database server scripts in the form of create scripts.
	 * @param ownerUri The URI of the connection to generate context scripts for.
	 */
	generateDatabaseServerContextualization(ownerUri: string): void;

	/**
	 * Gets all database server scripts in the form of create scripts.
	 * @param ownerUri The URI of the connection to get context scripts for.
	 */
	getDatabaseServerContextualization(ownerUri: string): Promise<azdata.contextualization.GetDatabaseServerContextualizationResult>;
}

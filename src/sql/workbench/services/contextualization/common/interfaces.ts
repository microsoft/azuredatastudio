/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';


export const SERVICE_ID = 'serverContextualizationService';
export const IServerContextualizationService = createDecorator<IServerContextualizationService>(SERVICE_ID);

export interface IServerContextualizationService {
	_serviceBrand: undefined;

	/**
	 * Register a server contextualization service provider
	 */
	registerProvider(providerId: string, provider: azdata.contextualization.ServerContextualizationProvider): void;

	/**
	 * Unregister a server contextualization service provider
	 */
	unregisterProvider(providerId: string): void;

	/**
	 * Gets a registered server contextualization service provider. An exception is thrown if a provider isn't registered with the specified ID
	 * @param providerId The ID of the registered provider
	 */
	getProvider(providerId: string): azdata.contextualization.ServerContextualizationProvider;

	/**
	 * Generates server context
	 * @param ownerUri The URI of the connection to generate context for.
	 */
	generateServerContextualization(ownerUri: string): void;

	/**
	 * Gets all database context.
	 * @param ownerUri The URI of the connection to get context for.
	 */
	getServerContextualization(ownerUri: string): Promise<azdata.contextualization.GetServerContextualizationResult>;
	/**
	 * Handles onGenerateServerContextualizationComplete events
	 */
	onGenerateServerContextualizationComplete(handle: number, serverContextualizationCompleteParams: azdata.contextualization.GenerateServerContextualizationCompleteParams): void
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
	 * Contextualizes the provided URI for GitHub Copilot.
	 * @param uri The URI to contextualize for Copilot.
	 * @returns Copilot will have the URI contextualized when the promise completes.
	 */
	contextualizeUriForCopilot(uri: string): Promise<void>;
}

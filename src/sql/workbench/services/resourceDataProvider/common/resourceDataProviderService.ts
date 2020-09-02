/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'resourceDataProviderService';
export const IResourceDataProviderService = createDecorator<IResourceDataProviderService>(SERVICE_ID);

export interface IResourceDataProviderService {
	_serviceBrand: undefined;

	/**
	 * Register a resource data provider
	 */
	registerProvider<T extends azdata.Resource>(providerId: string, provider: azdata.ResourceDataProvider<T>): void;

	/**
	 * Unregister a resource data provider
	 */
	unregisterProvider(providerId: string): void;

	/**
	 * Gets a list of resources from the specified provider
	 */
	getResources<T extends azdata.Resource>(providerId: string): Promise<T[]>;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'dataGridProviderService';
export const IDataGridProviderService = createDecorator<IDataGridProviderService>(SERVICE_ID);

export interface DataGridProvider extends azdata.DataGridProvider { }

export interface IDataGridProviderService {
	_serviceBrand: undefined;

	/**
	 * Register a data grid provider
	 */
	registerProvider(providerId: string, provider: azdata.DataGridProvider): void;

	/**
	 * Unregister a resource data provider
	 */
	unregisterProvider(providerId: string): void;

	/**
	 * Gets a registered data grid provider, throwing if none are registered with the specified ID
	 * @param providerId The id of the registered provider
	 */
	getDataGridProvider(providerId: string): DataGridProvider;

}

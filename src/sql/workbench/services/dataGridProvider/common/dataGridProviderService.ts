/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'dataGridProviderService';
export const IDataGridProviderService = createDecorator<IDataGridProviderService>(SERVICE_ID);

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
	 * Gets a list of data grid items from the specified provider
	 */
	getDataGridItems(providerId: string): Promise<azdata.DataGridItem[]>;

	/**
	* Gets a list of data grid columns from the specified provider
	*/
	getDataGridColumns(providerId: string): Promise<azdata.DataGridColumn[]>;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DataGridProvider, IDataGridProviderService } from 'sql/workbench/services/dataGridProvider/common/dataGridProviderService';
import { invalidProvider } from 'sql/base/common/errors';

export class DataGridProviderService implements IDataGridProviderService {

	public _serviceBrand: undefined;
	private _providers = new Map<string, azdata.DataGridProvider>();

	/**
	 * Register a data grid provider
	 */
	public registerProvider(providerId: string, provider: azdata.DataGridProvider): void {
		if (this._providers.has(providerId)) {
			throw new Error(`A DataGridProvider with id "${providerId}" is already registered`);
		}
		this._providers.set(providerId, provider);
	}

	public unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	public getDataGridProvider(providerId: string): DataGridProvider {
		const provider = this._providers.get(providerId);
		if (provider) {
			return provider;
		}
		throw invalidProvider(providerId);
	}
}

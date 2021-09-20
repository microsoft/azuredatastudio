/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableDesignerProvider, ITableDesignerService } from 'sql/workbench/services/tableDesigner/common/interface';
import { invalidProvider } from 'sql/base/common/errors';

export class TableDesignerService implements ITableDesignerService {

	public _serviceBrand: undefined;
	private _providers = new Map<string, TableDesignerProvider>();

	/**
	 * Register a data grid provider
	 */
	public registerProvider(providerId: string, provider: TableDesignerProvider): void {
		if (this._providers.has(providerId)) {
			throw new Error(`A table designer provider with id "${providerId}" is already registered`);
		}
		this._providers.set(providerId, provider);
	}

	public unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	public getProvider(providerId: string): TableDesignerProvider {
		const provider = this._providers.get(providerId);
		if (provider) {
			return provider;
		}
		throw invalidProvider(providerId);
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { Table } from 'sql/base/browser/ui/table/table';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IContextKey, IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';

export const InTable = new RawContextKey<boolean>('inTable', true);
export const FilteringEnabled = new RawContextKey<boolean>('filteringEnabled', false);

export class TableContext implements IDisposable {
	private _inTable: IContextKey<boolean>;
	private _filteringEnabled: IContextKey<boolean>;

	constructor(contextKeyService: IContextKeyService, table: Table<Slick.SlickData>) {
		this._inTable = InTable.bindTo(contextKeyService);
		this._filteringEnabled = FilteringEnabled.bindTo(contextKeyService);
		this._inTable.set(true);
		this._filteringEnabled.set(table.grid.getPlugins().find(p => p instanceof HeaderFilter) !== undefined);
	}

	dispose(): void {
	}
}

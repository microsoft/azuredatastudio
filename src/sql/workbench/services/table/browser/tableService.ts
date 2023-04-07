/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import { TableContext } from 'sql/workbench/services/table/browser/tableContext';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

export const SERVICE_ID = 'tableService';
export const ITableService = createDecorator<ITableService>(SERVICE_ID);

/**
 * Service to manage the table components used by the application.
 */
export interface ITableService {
	_serviceBrand: undefined;
	/**
	 * Register a table
	 */
	registerTable(table: Table<any>): IDisposable;
	/**
	 * Get the table that has the focus.
	 */
	getActiveTable(): Table<any> | undefined;
}

export class TableService implements ITableService {
	_serviceBrand: undefined;

	private _tables: Map<number, Table<any>> = new Map<number, Table<any>>();
	private _currentId: number = 1;

	constructor(@IContextKeyService private readonly _contextKeyService: IContextKeyService) { }

	registerTable(table: Table<any>): IDisposable {
		const id = this._currentId++;
		this._tables.set(id, table);
		const service = this._contextKeyService.createScoped(table.grid.getContainerNode());
		const context = new TableContext(service, table);

		return {
			dispose: () => {
				this._tables.delete(id);
				service.dispose();
				context.dispose();
			}
		};
	}

	getActiveTable(): Table<any> | undefined {
		for (const table of this._tables.values()) {
			if (table?.grid.getContainerNode().contains(document.activeElement)) {
				return table;
			}
		}
		return undefined;
	}
}

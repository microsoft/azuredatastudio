/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import { FilteringEnabled, InTable } from 'sql/workbench/services/table/browser/tableContext';
import { ITableService } from 'sql/workbench/services/table/browser/tableService';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { KeybindingWeight, KeybindingsRegistry } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { HybridDataProvider } from 'sql/base/browser/ui/table/hybridDataProvider';

export const RESIZE_COLUMN_COMMAND_ID = 'table.resizeColumn';
export const SHOW_COLUMN_MENU_COMMAND_ID = 'table.showColumnMenu';
export const SORT_COLUMN_COMMAND_ID = 'table.sortColumn';

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: RESIZE_COLUMN_COMMAND_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: InTable,
	primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyS,
	handler: async (accessor) => {
		await handleTableCommand(accessor, async (table) => {
			await table.resizeActiveColumn();
		});
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: SHOW_COLUMN_MENU_COMMAND_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeyExpr.and(InTable, FilteringEnabled),
	primary: KeyCode.F3,
	handler: async (accessor) => {
		await handleTableCommand(accessor, async (table) => {
			let plugin = table.grid.getPlugins().find(p => p instanceof HeaderFilter) as HeaderFilter<any>;
			if (plugin) {
				await plugin.showMenu();
			}
		});
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: SORT_COLUMN_COMMAND_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: InTable,
	primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyO,
	handler: async (accessor) => {
		await handleTableCommand(accessor, async (table) => {
			const activeCell = table.grid.getActiveCell();
			if (activeCell && activeCell.cell >= 0) {
				const column = table.grid.getColumns()[activeCell.cell];
				if (column.sortable) {
					table.grid.sortColumnByActiveCell();
				} else if (table.getData() instanceof HybridDataProvider) {
					// For query editor/notebook, we don't use the slickgrid's builtin sorting, so handle it separately here.
					let columnState = table.grid.getSortColumns().find(c => c.columnId === column.id);
					if (columnState) {
						columnState.sortAsc = !columnState.sortAsc;
					} else {
						columnState = {
							columnId: column.id,
							sortAsc: true
						};
					}
					table.grid.setSortColumn(columnState.columnId, columnState.sortAsc);

					const dataProvider = table.getData() as HybridDataProvider<Slick.SlickData>;
					await dataProvider.sort({
						grid: table.grid,
						multiColumnSort: false,
						sortCol: column,
						sortAsc: columnState.sortAsc
					});
					table.rerenderGrid();
					table.setActiveCell(activeCell.row, activeCell.cell);
				}
			}
		});
	}
});

async function handleTableCommand(accessor: ServicesAccessor, action: (table: Table<any>) => Promise<void>) {
	const tableService = accessor.get(ITableService);
	const table = tableService.getActiveTable();
	if (table) {
		await action(table);
	}
}


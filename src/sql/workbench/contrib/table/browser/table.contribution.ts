/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import { TableFilteringEnabledContextKey, InTableContextKey } from 'sql/workbench/services/componentContext/browser/contextKeys';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { KeybindingWeight, KeybindingsRegistry } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { HybridDataProvider } from 'sql/base/browser/ui/table/hybridDataProvider';
import { IComponentContextService } from 'sql/workbench/services/componentContext/browser/componentContextService';

export const RESIZE_COLUMN_COMMAND_ID = 'grid.resizeColumn';
export const SHOW_COLUMN_MENU_COMMAND_ID = 'grid.showColumnMenu';
export const SORT_COLUMN_COMMAND_ID = 'grid.sortColumn';

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: RESIZE_COLUMN_COMMAND_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: InTableContextKey,
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
	when: ContextKeyExpr.and(InTableContextKey, TableFilteringEnabledContextKey),
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
	when: InTableContextKey,
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
	const service = accessor.get(IComponentContextService);
	const table = service.getActiveTable();
	if (table) {
		await action(table);
	}
}


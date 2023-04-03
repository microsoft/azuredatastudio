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

export const RESIZE_COLUMN_COMMAND_ID = 'table.resizeColumn';
export const SHOW_COLUMN_MENU_COMMAND_ID = 'table.showColumnMenu';

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: RESIZE_COLUMN_COMMAND_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: InTable,
	primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyS,
	handler: (accessor) => {
		handleTableCommand(accessor, async (table) => {
			await table.resizeActiveColumn();
		});
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: SHOW_COLUMN_MENU_COMMAND_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeyExpr.and(InTable, FilteringEnabled),
	primary: KeyCode.F3,
	handler: (accessor) => {
		handleTableCommand(accessor, async (table) => {
			let plugin = table.grid.getPlugins().find(p => p instanceof HeaderFilter) as HeaderFilter<any>;
			if (plugin) {
				await plugin.showMenu();
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


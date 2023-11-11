/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import * as DOM from 'vs/base/browser/dom';
import { deepClone } from 'vs/base/common/objects';

export const TableRowHeight = 25;
export const TableHeaderRowHeight = 28;
export const ScrollbarSize = 15;
const minHeight = getTableHeight(1);

/**
 * Layout the table, the height will be determined by the number of rows in it.
 * @param table the table.
 * @param width width of the table
 */
export function layoutDesignerTable(table: Table<Slick.SlickData>, width: number): void {
	let activeCell: Slick.Cell = undefined;
	if (table.container.contains(document.activeElement)) {
		// Note down the current active cell if the focus is currently in the table
		// After the table layout operation is done, the focus will be restored.
		activeCell = deepClone(table.activeCell);
	}
	const rows = table.getData().getLength();
	const actualHeight = getTableHeight(rows);
	const height = Math.max(minHeight, actualHeight);
	table.layout(new DOM.Dimension(width - 20 /* Padding and scroll bar */, height));
	if (activeCell && rows > activeCell.row) {
		table.setActiveCell(activeCell.row, activeCell.cell);
	}
}

function getTableHeight(rows: number): number {
	return rows * TableRowHeight + TableHeaderRowHeight + ScrollbarSize;
}

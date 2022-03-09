/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import * as DOM from 'vs/base/browser/dom';

export const TableRowHeight = 25;
export const TableHeaderRowHeight = 28;

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
		activeCell = Object.assign({}, table.activeCell);
	}
	const rows = table.getData().getLength();
	// Tables in designer will have minimum height of 2 rows
	const actualHeight = getTableHeight(rows);
	const minHeight = getTableHeight(2);
	const height = Math.max(minHeight, actualHeight);
	table.layout(new DOM.Dimension(width - 20 /* Padding and scroll bar */, height));
	if (activeCell && rows > activeCell.row) {
		table.setActiveCell(activeCell.row, activeCell.cell);
	}
}

function getTableHeight(rows: number): number {
	return rows * TableRowHeight + TableHeaderRowHeight;
}

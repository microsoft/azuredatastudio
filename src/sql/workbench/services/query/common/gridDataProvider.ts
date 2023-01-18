/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from 'vs/base/common/types';
import { SaveFormat } from 'sql/workbench/services/query/common/resultSerializer';
import { ResultSetSubset } from 'sql/workbench/services/query/common/query';
import { IDisposableDataProvider } from 'sql/base/common/dataProvider';

export interface IGridDataProvider {

	/**
	 * Gets N rows of data
	 * @param rowStart 0-indexed start row to retrieve data from
	 * @param numberOfRows total number of rows of data to retrieve
	 */
	getRowData(rowStart: number, numberOfRows: number): Thenable<ResultSetSubset>;

	/**
	 * Sends a copy request to copy data to the clipboard
	 * @param selection The selection range to copy
	 * @param includeHeaders [Optional]: Should column headers be included in the copy selection
	 * @param tableView [Optional]: The data view associated with the table component
	 */
	copyResults(selection: Slick.Range[], includeHeaders?: boolean, tableView?: IDisposableDataProvider<Slick.SlickData>): Promise<void>;

	/**
	 * Sends a copy request to copy table headers to the clipboard
	 * @param selection The selection range to copy
	 */
	copyHeaders(selection: Slick.Range[]): Promise<void>;

	/**
	 * Gets the EOL terminator to use for this data type.
	 */
	getEolString(): string;

	shouldIncludeHeaders(includeHeaders: boolean): boolean;

	shouldRemoveNewLines(): boolean;

	getColumnHeaders(range: Slick.Range): string[] | undefined;

	readonly canSerialize: boolean;

	serializeResults(format: SaveFormat, selection: Slick.Range[]): Thenable<void>;

}

export async function getResultsString(provider: IGridDataProvider, selection: Slick.Range[], includeHeaders?: boolean, tableView?: IDisposableDataProvider<Slick.SlickData>): Promise<string> {
	let headers: Map<number, string> = new Map(); // Maps a column index -> header
	let rows: Map<number, Map<number, string>> = new Map(); // Maps row index -> column index -> actual row value
	const eol = provider.getEolString();

	// create a mapping of the ranges to get promises
	let tasks: (() => Promise<void>)[] = selection.map((range) => {
		return async (): Promise<void> => {
			let startCol = range.fromCell;
			let startRow = range.fromRow;
			let result;
			if (tableView && tableView.isDataInMemory) {
				// If the data is sorted/filtered in memory, we need to get the data that is currently being displayed
				const tableData = await tableView.getRangeAsync(range.fromRow, range.toRow - range.fromRow + 1);
				result = tableData.map(item => Object.keys(item).map(key => item[key]));
			} else {
				result = (await provider.getRowData(range.fromRow, range.toRow - range.fromRow + 1)).rows;
			}
			// If there was a previous selection separate it with a line break. Currently
			// when there are multiple selections they are never on the same line
			let columnHeaders = provider.getColumnHeaders(range);
			if (columnHeaders !== undefined) {
				let idx = 0;
				for (let header of columnHeaders) {
					headers.set(startCol + idx, header);
					idx++;
				}
			}
			// Iterate over the rows to paste into the copy string
			for (let rowIndex: number = 0; rowIndex < result.length; rowIndex++) {
				let row = result[rowIndex];
				let cellObjects = row.slice(range.fromCell, (range.toCell + 1));
				// Remove newlines if requested
				let cells = provider.shouldRemoveNewLines()
					? cellObjects.map(x => removeNewLines(x.displayValue))
					: cellObjects.map(x => x.displayValue);

				let idx = 0;
				for (let cell of cells) {
					let map = rows.get(rowIndex + startRow);
					if (!map) {
						map = new Map();
						rows.set(rowIndex + startRow, map);
					}

					map.set(startCol + idx, cell);
					idx++;
				}
			}
		};
	});

	// Set the tasks gathered above to execute
	let actionedTasks: Promise<void>[] = tasks.map(t => { return t(); });

	// Make sure all these tasks have executed
	await Promise.all(actionedTasks);

	headers = sortMapEntriesByColumnOrder(headers);
	rows = sortMapEntriesByColumnOrder(rows);

	let copyString = '';
	if (includeHeaders) {
		copyString = Array.from(headers.values()).join('\t').concat(eol);
	}

	const rowKeys = [...headers.keys()];
	for (let rowEntry of rows) {
		let rowMap = rowEntry[1];
		for (let rowIdx of rowKeys) {

			let value = rowMap.get(rowIdx);
			if (value) {
				copyString = copyString.concat(value);
			}
			copyString = copyString.concat('\t');
		}
		// Removes the tab seperator from the end of a row
		copyString = copyString.slice(0, -1 * '\t'.length);
		copyString = copyString.concat(eol);
	}
	// Removes EoL from the end of the result
	copyString = copyString.slice(0, -1 * eol.length);

	return copyString;
}

export function getTableHeaderString(provider: IGridDataProvider, selection: Slick.Range[]): string {
	let headers: Map<number, string> = new Map(); // Maps a column index -> header

	selection.forEach((range) => {
		let startCol = range.fromCell;
		let columnHeaders = provider.getColumnHeaders(range);
		if (columnHeaders !== undefined) {
			let idx = 0;
			for (let header of columnHeaders) {
				headers.set(startCol + idx, header);
				idx++;
			}
		}
	});

	headers = sortMapEntriesByColumnOrder(headers)

	const copyString = Array.from(headers.values())
		.map(colHeader => colHeader ? colHeader : '')
		.join('\t');

	return copyString;
}

/**
 * Ensures that table entries in the map appear in column order instead of the order that they were selected.
 * @param map Contains the entries selected in a table
 * @returns Sorted map with entries appearing in column order.
 */
function sortMapEntriesByColumnOrder(map: Map<number, any>): Map<number, any> {
	const leftToRight = (e1: [number, any], e2: [number, any]) => {
		return e1[0] - e2[0];
	};

	return new Map([...map].sort(leftToRight));
}

function removeNewLines(inputString: string): string {
	// This regex removes all newlines in all OS types
	// Windows(CRLF): \r\n
	// Linux(LF)/Modern MacOS: \n
	// Old MacOs: \r
	if (types.isUndefinedOrNull(inputString)) {
		return 'null';
	}

	let outputString: string = inputString.replace(/(\r\n|\n|\r)/gm, ' ');
	return outputString;
}

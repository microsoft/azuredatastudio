/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as types from 'vs/base/common/types';
import { SaveFormat } from 'sql/workbench/parts/grid/common/interfaces';

export interface IGridDataProvider {

	/**
	 * Gets N rows of data
	 * @param rowStart 0-indexed start row to retrieve data from
	 * @param numberOfRows total number of rows of data to retrieve
	 */
	getRowData(rowStart: number, numberOfRows: number): Thenable<azdata.QueryExecuteSubsetResult>;

	/**
	 * Sends a copy request to copy data to the clipboard
	 * @param selection The selection range to copy
	 * @param batchId The batch id of the result to copy from
	 * @param resultId The result id of the result to copy from
	 * @param includeHeaders [Optional]: Should column headers be included in the copy selection
	 */
	copyResults(selection: Slick.Range[], includeHeaders?: boolean): void;

	/**
	 * Gets the EOL terminator to use for this data type.
	 */
	getEolString(): string;

	shouldIncludeHeaders(includeHeaders: boolean): boolean;

	shouldRemoveNewLines(): boolean;

	getColumnHeaders(range: Slick.Range): string[];

	readonly canSerialize: boolean;

	serializeResults(format: SaveFormat, selection: Slick.Range[]): Thenable<void>;

}

export async function getResultsString(provider: IGridDataProvider, selection: Slick.Range[], includeHeaders?: boolean): Promise<string> {
	let headers: Map<Number, string> = new Map();
	let rows: Map<Number, Map<Number, string>> = new Map();
	let copyTable: string[][] = [];
	const eol = provider.getEolString();

	// create a mapping of the ranges to get promises
	let tasks = selection.map((range, i) => {
		return async () => {
			let selectionsCopy = selection;
			let startCol = range.fromCell;
			let startRow = range.fromRow;

			const result = await provider.getRowData(range.fromRow, range.toRow - range.fromRow + 1);
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
			for (let rowIndex: number = 0; rowIndex < result.resultSubset.rows.length; rowIndex++) {
				let row = result.resultSubset.rows[rowIndex];
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

	if (tasks.length > 0) {
		let p = tasks[0]();
		for (let i = 1; i < tasks.length; i++) {
			p = p.then(tasks[i]);
		}
		await p;
	}

	let copyString = '';
	if (includeHeaders) {
		copyString = [...headers.values()].join('\t').concat(eol);
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
		copyString = copyString.concat(eol);
	}
	// Removes EoL from the end of the string
	copyString = copyString.slice(0, -1 * eol.length);

	return copyString;
}


function removeNewLines(inputString: string): string {
	// This regex removes all newlines in all OS types
	// Windows(CRLF): \r\n
	// Linux(LF)/Modern MacOS: \n
	// Old MacOs: \r
	if (types.isUndefinedOrNull(inputString)) {
		return 'null';
	}

	let outputString: string = inputString.replace(/(\r\n|\n|\r)/gm, '');
	return outputString;
}

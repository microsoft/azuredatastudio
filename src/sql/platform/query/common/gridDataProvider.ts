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
	let copyTable: string[][] = [];
	const eol = provider.getEolString();

	// create a mapping of the ranges to get promises
	let tasks = selection.map((range, i) => {
		return async () => {
			const result = await provider.getRowData(range.fromRow, range.toRow - range.fromRow + 1);
			// If there was a previous selection separate it with a line break. Currently
			// when there are multiple selections they are never on the same line
			if (provider.shouldIncludeHeaders(includeHeaders)) {
				let columnHeaders = provider.getColumnHeaders(range);
				if (columnHeaders !== undefined) {
					if (copyTable[0] === undefined) {
						copyTable[0] = [];
					}
					copyTable[0].push(...columnHeaders);
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

				let idx = rowIndex + 1;
				if (copyTable[idx] === undefined) {
					copyTable[idx] = [];
				}
				copyTable[idx].push(...cells);
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
	copyTable.forEach((row) => {
		if (row === undefined) {
			return;
		}
		copyString = copyString.concat(row.join('\t').concat(eol));
	});

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
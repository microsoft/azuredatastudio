/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from 'vs/base/common/types';
import { SaveFormat } from 'sql/workbench/services/query/common/resultSerializer';
import { ICellValue, ResultSetSubset } from 'sql/workbench/services/query/common/query';
import { IDisposableDataProvider } from 'sql/base/common/dataProvider';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import * as nls from 'vs/nls';
import { toAction } from 'vs/base/common/actions';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

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

interface Range {
	start: number;
	end: number;
}

/**
 * Merge the ranges and get the sorted ranges.
 */
function mergeRanges(ranges: Range[]): Range[] {
	const mergedRanges: Range[] = [];
	const orderedRanges = ranges.sort((s1, s2) => { return s1.start - s2.start; });
	orderedRanges.forEach(range => {
		let merged = false;
		for (let i = 0; i < mergedRanges.length; i++) {
			const mergedRange = mergedRanges[i];
			if (range.start <= mergedRange.end) {
				mergedRange.end = Math.max(range.end, mergedRange.end);
				merged = true;
				break;
			}
		}
		if (!merged) {
			mergedRanges.push(range);
		}
	});
	return mergedRanges;
}

export async function copySelectionToClipboard(clipboardService: IClipboardService, notificationService: INotificationService, provider: IGridDataProvider, selections: Slick.Range[], includeHeaders?: boolean, tableView?: IDisposableDataProvider<Slick.SlickData>): Promise<void> {
	const batchSize = 100;
	const eol = provider.getEolString();
	const valueSeparator = '\t';
	const shouldRemoveNewLines = provider.shouldRemoveNewLines();

	// Merge the selections to get the columns and rows.
	const columnRanges: Range[] = mergeRanges(selections.map(selection => { return { start: selection.fromCell, end: selection.toCell }; }));
	const rowRanges: Range[] = mergeRanges(selections.map(selection => { return { start: selection.fromRow, end: selection.toRow }; }));

	const totalRows = rowRanges.map(range => range.end - range.start + 1).reduce((p, c) => p + c);

	let processedRows = 0;
	const getMessageText = (): string => {
		return nls.localize('gridDataProvider.loadingRowsInProgress', "Loading the rows to be copied ({0}/{1})...", processedRows, totalRows);
	};

	let isCanceled = false;

	const notificationHandle = notificationService.notify({
		message: getMessageText(),
		severity: Severity.Info,
		progress: {
			infinite: true
		},
		actions: {
			primary: [
				toAction({
					id: 'cancelCopyResults',
					label: nls.localize('gridDataProvider.cancelCopyResults', "Cancel"),
					run: () => {
						isCanceled = true;
						notificationHandle.close();
					}
				})]
		}
	});

	let resultString = '';
	if (includeHeaders) {
		const headers: string[] = [];
		columnRanges.forEach(range => {
			headers.push(...provider.getColumnHeaders(<Slick.Range>{
				fromCell: range.start,
				toCell: range.end
			}));
		});
		resultString = Array.from(headers.values()).join(valueSeparator).concat(eol);
	}

	const batchResult: string[] = [];
	for (const range of rowRanges) {
		if (tableView && tableView.isDataInMemory) {
			const rangeLength = range.end - range.start + 1;
			// If the data is sorted/filtered in memory, we need to get the data that is currently being displayed
			const tableData = await tableView.getRangeAsync(range.start, rangeLength);
			const rowSet = tableData.map(item => Object.keys(item).map(key => item[key]));
			batchResult.push(getStringValueForRowSet(rowSet, columnRanges, selections, range.start, eol, valueSeparator, shouldRemoveNewLines));
			processedRows += rangeLength;
			notificationHandle.updateMessage(getMessageText());
		} else {
			let start = range.start;
			do {
				const end = Math.min(start + batchSize - 1, range.end);
				const batchLength = end - start + 1
				const rowSet = (await provider.getRowData(start, batchLength)).rows;
				batchResult.push(getStringValueForRowSet(rowSet, columnRanges, selections, range.start, eol, valueSeparator, shouldRemoveNewLines));
				start = end + 1;
				processedRows = processedRows + batchLength;
				if (!isCanceled) {
					notificationHandle.updateMessage(getMessageText());
				}
			} while (start < range.end && !isCanceled)
		}
	}
	if (!isCanceled) {
		resultString += batchResult.join(eol);
		notificationHandle.progress.done();
		notificationHandle.updateActions({
			primary: [
				toAction({
					id: 'closeCopyResultsNotification',
					label: nls.localize('gridDataProvider.closeNotification', "Close"),
					run: () => { notificationHandle.close(); }
				})]
		});
		await clipboardService.writeText(resultString);
		notificationHandle.updateMessage(nls.localize('gridDataProvider.copyResultsCompleted', "Selected data has been copied to the clipboard. Row count: {0}.", totalRows));
	}
}

function getStringValueForRowSet(rows: ICellValue[][], columnRanges: Range[], selections: Slick.Range[], rowSetStartIndex: number, eol: string, valueSeparator: string, shouldRemoveNewLines: boolean): string {
	let rowStrings: string[] = [];
	rows.forEach((values, index) => {
		const rowIndex = index + rowSetStartIndex;
		const rowValues = [];
		columnRanges.forEach(cr => {
			for (let i = cr.start; i <= cr.end; i++) {
				if (selections.some(selection => selection.contains(rowIndex, i))) {
					rowValues.push(shouldRemoveNewLines ? removeNewLines(values[i].displayValue) : values[i].displayValue);
				} else {
					rowValues.push('');
				}
			}
		});
		rowStrings.push(rowValues.join(valueSeparator));
	});
	return rowStrings.join(eol);
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

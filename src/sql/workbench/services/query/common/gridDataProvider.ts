/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from 'vs/base/common/types';
import { SaveFormat } from 'sql/workbench/services/query/common/resultSerializer';
import { ICellValue, ResultSetSubset } from 'sql/workbench/services/query/common/query';
import { IDisposableDataProvider } from 'sql/base/common/dataProvider';
import { INotificationHandle, INotificationService, Severity } from 'vs/platform/notification/common/notification';
import * as nls from 'vs/nls';
import { toAction } from 'vs/base/common/actions';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { GridRange } from 'sql/base/common/gridRange';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';

export interface IGridDataProvider {

	/**
	 * Gets N rows of data
	 * @param rowStart 0-indexed start row to retrieve data from
	 * @param numberOfRows total number of rows of data to retrieve
	 */
	getRowData(rowStart: number, numberOfRows: number, cancellationToken?: CancellationToken, onProgressCallback?: (availableRows: number) => void): Thenable<ResultSetSubset>;

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

	shouldSkipNewLineAfterTrailingLineBreak(): boolean;

	getColumnHeaders(range: Slick.Range): string[] | undefined;

	readonly canSerialize: boolean;

	serializeResults(format: SaveFormat, selection: Slick.Range[]): Thenable<void>;
}

export async function executeCopyWithNotification(notificationService: INotificationService, configurationService: IConfigurationService, selections: Slick.Range[], copyHandler: (notification: INotificationHandle, rowCount: number) => Promise<void>, cancellationTokenSource?: CancellationTokenSource): Promise<void> {
	const rowRanges = GridRange.getUniqueRows(GridRange.fromSlickRanges(selections));
	const rowCount = rowRanges.map(range => range.end - range.start + 1).reduce((p, c) => p + c);
	const showCopyCompleteNotifications = configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.showCopyCompletedNotification;
	const notificationHandle = notificationService.notify({
		message: nls.localize('gridDataProvider.copying', "Copying..."),
		severity: Severity.Info,
		progress: {
			infinite: true
		},
		actions: {
			primary: cancellationTokenSource ? [
				toAction({
					id: 'cancelCopyResults',
					label: nls.localize('gridDataProvider.cancelCopyResults', "Cancel"),
					run: () => {
						cancellationTokenSource.cancel();
						notificationHandle.close();
					}
				})] : []
		}
	});
	try {
		await copyHandler(notificationHandle, rowCount);
		if (cancellationTokenSource === undefined || !cancellationTokenSource.token.isCancellationRequested) {
			notificationHandle.progress.done();
			if (showCopyCompleteNotifications) {
				notificationHandle.updateActions({
					primary: [
						toAction({
							id: 'closeCopyResultsNotification',
							label: nls.localize('gridDataProvider.closeNotification', 'Close'),
							run: () => { notificationHandle.close(); }
						}),
						toAction({
							id: 'disableCopyNotification',
							label: nls.localize('gridDataProvider.disableCopyNotification', `Don't show again`),
							run: () => {
								updateConfigTurnOffCopyNotifications(configurationService);
								notificationService.info(nls.localize('gridDataProvider.turnOnCopyNotificationsMessage',
									'Copy completed notifications are now disabled. To re-enable, modify the setting: queryEditor.results.showCopyCompletedNotification'))
							}
						})]
				});
				notificationHandle.updateMessage(nls.localize('gridDataProvider.copyResultsCompleted', "Selected data has been copied to the clipboard. Row count: {0}.", rowCount));
				// Auto-close notification after 3 seconds.
				setTimeout(() => notificationHandle.close(), 3000);
			} else {
				notificationHandle.close();
			}
		}
	}
	catch (err) {
		notificationHandle.close();
		throw err;
	}
}

export async function copySelectionToClipboard(clipboardService: IClipboardService, notificationService: INotificationService, configurationService: IConfigurationService,
	provider: IGridDataProvider, selections: Slick.Range[], includeHeaders?: boolean, tableView?: IDisposableDataProvider<Slick.SlickData>): Promise<void> {
	const cancellationTokenSource = new CancellationTokenSource()
	await executeCopyWithNotification(notificationService, configurationService, selections, async (notificationHandle, rowCount) => {
		const eol = provider.getEolString();
		const valueSeparator = '\t';
		const shouldRemoveNewLines = provider.shouldRemoveNewLines();
		const shouldSkipNewLineAfterTrailingLineBreak = provider.shouldSkipNewLineAfterTrailingLineBreak();

		// Merge the selections to get the unique columns and unique rows.
		const gridRanges = GridRange.fromSlickRanges(selections);
		const columnRanges = GridRange.getUniqueColumns(gridRanges);
		const rowRanges = GridRange.getUniqueRows(gridRanges);

		let processedRows = 0;
		const getMessageText = (): string => {
			return nls.localize('gridDataProvider.loadingRowsInProgress', "Loading the rows to be copied ({0}/{1})...", processedRows, rowCount);
		};
		let headerString = '';
		if (includeHeaders) {
			const headers: string[] = [];
			columnRanges.forEach(range => {
				headers.push(...provider.getColumnHeaders(<Slick.Range>{
					fromCell: range.start,
					toCell: range.end
				}));
			});
			headerString = Array.from(headers.values()).join(valueSeparator).concat(eol);
		}

		const rowValues: string[] = [];
		for (const range of rowRanges) {
			let rows: ICellValue[][];
			let processedRowsSnapshot = processedRows;
			const rangeLength = range.end - range.start + 1;
			if (tableView && tableView.isDataInMemory) {
				// If the data is sorted/filtered in memory, we need to get the data that is currently being displayed
				const tableData = await tableView.getRangeAsync(range.start, rangeLength);
				rows = tableData.map(item => Object.keys(item).map(key => item[key]));
				processedRows += rangeLength;
				notificationHandle.updateMessage(getMessageText());
			} else {
				rows = (await provider.getRowData(range.start, rangeLength, cancellationTokenSource.token, (fetchedRows) => {
					processedRows = processedRowsSnapshot + fetchedRows;
					notificationHandle.updateMessage(getMessageText());
				})).rows;
			}
			rows.forEach((values, index) => {
				const rowIndex = index + range.start;
				const columnValues = [];
				columnRanges.forEach(cr => {
					for (let i = cr.start; i <= cr.end; i++) {
						if (selections.some(selection => selection.contains(rowIndex, i))) {
							columnValues.push(shouldRemoveNewLines ? removeNewLines(values[i].displayValue) : values[i].displayValue);
						}
					}
				});
				rowValues.push(columnValues.join(valueSeparator));
			});
		}
		if (!cancellationTokenSource.token.isCancellationRequested) {
			const resultParts: string[] = [];
			if (includeHeaders)
				resultParts.push(headerString);

			if (rowValues.length > 0) {
				let prevVal = rowValues[0];
				resultParts.push(prevVal);

				for (let i = 1; i < rowValues.length; i++) {
					const currVal = rowValues[i];
					resultParts.push((!prevVal?.endsWith(eol) || !shouldSkipNewLineAfterTrailingLineBreak ? eol : '') + currVal);
					prevVal = currVal;
				}
			}

			await clipboardService.writeText(resultParts.join(""));
		}
	}, cancellationTokenSource);
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

/**
 * Disables data copy configuration setting.
 */
function updateConfigTurnOffCopyNotifications(configurationService: IConfigurationService) {
	configurationService.updateValue('queryEditor.results.showCopyCompletedNotification', false);
}

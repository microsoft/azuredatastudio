/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { defaultSort, TableDataView } from 'sql/base/browser/ui/table/tableDataView';

suite('TableDataView', () => {
	test('Data can be filtered and filter can be cleared', () => {
		const rowCount = 10;
		const columnCount = 5;
		const originalData = populateData(rowCount, columnCount);

		let filteredRowCount = 5;
		const obj = new TableDataView(originalData, undefined, undefined, (data: any[]) => {
			return populateData(filteredRowCount, columnCount);
		});

		let rowCountEventInvokeCount = 0;
		let filterStateChangeEventInvokeCount = 0;
		let rowCountEventParameter: number;
		obj.onRowCountChange((count) => {
			rowCountEventInvokeCount++;
			rowCountEventParameter = count;
		});

		obj.onFilterStateChange(() => {
			filterStateChangeEventInvokeCount++;
		});

		let verify = (expectedRowCountChangeInvokeCount: number,
			expectedDataLength: number,
			expectedNonFilteredDataLength: number,
			expectedFilterStateChangeInvokeCount: number,
			stepName: string,
			verifyRowCountEventParameter: boolean = true) => {
			assert.strictEqual(rowCountEventInvokeCount, expectedRowCountChangeInvokeCount, 'RowCountChange event count - ' + stepName);
			if (verifyRowCountEventParameter) {
				assert.strictEqual(rowCountEventParameter, expectedDataLength, 'Row count passed by RowCountChange event - ' + stepName);
			}
			assert.strictEqual(obj.getLength(), expectedDataLength, 'Data length - ' + stepName);
			assert.strictEqual(obj.getLengthNonFiltered(), expectedNonFilteredDataLength, 'Length for all data - ' + stepName);
			assert.strictEqual(filterStateChangeEventInvokeCount, expectedFilterStateChangeInvokeCount, 'FilterStateChange event count - ' + stepName);
		};

		verify(0, rowCount, rowCount, 0, 'after initialization', false);

		obj.filter();

		verify(0, filteredRowCount, rowCount, 1, 'after filtering', false);

		const additionalRowCount = 20;
		const additionalData = populateData(additionalRowCount, columnCount);
		obj.push(additionalData);

		verify(1, filteredRowCount * 2, rowCount + additionalRowCount, 1, 'after adding more data');

		obj.clearFilter();

		verify(1, rowCount + additionalRowCount, rowCount + additionalRowCount, 2, 'after clearing filter', false);

		//From this point on, nothing matches the filter criteria
		filteredRowCount = 0;

		obj.filter();
		verify(1, 0, rowCount + additionalRowCount, 3, 'after 2nd filtering', false);

		obj.push(additionalData);
		verify(2, 0, rowCount + additionalRowCount + additionalRowCount, 3, 'after 2nd adding more data');

		obj.clearFilter();
		verify(2, rowCount + additionalRowCount + additionalRowCount, rowCount + additionalRowCount + additionalRowCount, 4, 'after 2nd clearing filter', false);

		obj.clearFilter();
		verify(2, rowCount + additionalRowCount + additionalRowCount, rowCount + additionalRowCount + additionalRowCount, 4, 'calling clearFilter() multiple times', false);
	});

	test('Search can find items', async () => {
		const rowCount = 10;
		const columnCount = 5;
		const originalData = populateData(rowCount, columnCount);

		const searchFn = (val: { [x: string]: string }, exp: string): Array<number> => {
			const ret = new Array<number>();
			for (let i = 0; i < columnCount; i++) {
				const colVal = val[getColumnName(i)];
				if (colVal && colVal.toLocaleLowerCase().indexOf(exp.toLocaleLowerCase()) > -1) {
					ret.push(i);
				}
			}
			return ret;
		};

		const dataView = new TableDataView(originalData, searchFn);

		let findValue = await dataView.find('row 2');
		assert.deepStrictEqual(findValue, { row: 2, col: 0 });
		findValue = await dataView.findNext();
		assert.deepStrictEqual(findValue, { row: 2, col: 1 });
		findValue = await dataView.findNext();
		assert.deepStrictEqual(findValue, { row: 2, col: 2 });
		findValue = await dataView.findNext();
		assert.deepStrictEqual(findValue, { row: 2, col: 3 });
		findValue = await dataView.findNext();
		assert.deepStrictEqual(findValue, { row: 2, col: 4 });
		// find will loop around once it reaches the end
		findValue = await dataView.findNext();
		assert.deepStrictEqual(findValue, { row: 2, col: 0 });
	});

	test('Search fails correctly', async () => {
		const rowCount = 10;
		const columnCount = 5;
		const originalData = populateData(rowCount, columnCount);

		const searchFn = (val: { [x: string]: string }, exp: string): Array<number> => {
			const ret = new Array<number>();
			for (let i = 0; i < columnCount; i++) {
				const colVal = val[getColumnName(i)];
				if (colVal && colVal.toLocaleLowerCase().indexOf(exp.toLocaleLowerCase()) > -1) {
					ret.push(i);
				}
			}
			return ret;
		};

		const dataView = new TableDataView(originalData, searchFn);

		try {
			// we haven't started a search so we should throw
			await dataView.findNext();
			assert.fail();
		} catch (e) {

		}

		await dataView.find('row 2');
		dataView.clearFind();

		try {
			// we cleared the search and haven't started a new search so we should throw
			await dataView.findNext();
			assert.fail();
		} catch (e) {

		}
	});

	test('Search respects max finds', async () => {
		const rowCount = 10;
		const columnCount = 5;
		const originalData = populateData(rowCount, columnCount);

		const searchFn = (val: { [x: string]: string }, exp: string): Array<number> => {
			const ret = new Array<number>();
			for (let i = 0; i < columnCount; i++) {
				const colVal = val[getColumnName(i)];
				if (colVal && colVal.toLocaleLowerCase().indexOf(exp.toLocaleLowerCase()) > -1) {
					ret.push(i);
				}
			}
			return ret;
		};

		const dataView = new TableDataView(originalData, searchFn);

		let findValue = await dataView.find('row 2', 2);
		assert.deepStrictEqual(findValue, { row: 2, col: 0 });
		findValue = await dataView.findNext();
		assert.deepStrictEqual(findValue, { row: 2, col: 1 });
		// find will loop around once it reaches the end
		findValue = await dataView.findNext();
		assert.deepStrictEqual(findValue, { row: 2, col: 0 });
	});

	test('Default Sorter test', async () => {
		const originalData: Slick.SlickData[] = [
			{ fieldName: '10b' },
			{ fieldName: undefined },
			{ fieldName: '100.01' },
			{ fieldName: undefined },
			{ fieldName: '10.1' },
			{ fieldName: 'abc' }
		];

		const sortAscArg: Slick.OnSortEventArgs<Slick.SlickData> = {
			sortAsc: true,
			sortCol: {
				field: 'fieldName'
			},
			multiColumnSort: false,
			grid: undefined
		};

		const sortDescArg: Slick.OnSortEventArgs<Slick.SlickData> = {
			sortAsc: false,
			sortCol: {
				field: 'fieldName'
			},
			multiColumnSort: false,
			grid: undefined
		};
		const expectedAsc: Slick.SlickData[] = [
			{ fieldName: undefined },
			{ fieldName: undefined },
			{ fieldName: '10.1' },
			{ fieldName: '100.01' },
			{ fieldName: '10b' },
			{ fieldName: 'abc' }
		];
		const sortedAsc = defaultSort(sortAscArg, originalData);
		assert.deepStrictEqual(sortedAsc, expectedAsc, 'ascending sorting is not working as expected');
		const expectedDesc: Slick.SlickData[] = [
			{ fieldName: 'abc' },
			{ fieldName: '10b' },
			{ fieldName: '100.01' },
			{ fieldName: '10.1' },
			{ fieldName: undefined },
			{ fieldName: undefined },
		];
		const sortedDesc = defaultSort(sortDescArg, originalData);
		assert.deepStrictEqual(sortedDesc, expectedDesc, 'descending sorting is not working as expected');
	});
});

function populateData(row: number, column: number): any[] {
	let data: Array<{ [key: string]: string }> = [];
	for (let i: number = 0; i < row; i++) {
		let row: { [key: string]: string } = {};
		for (let j: number = 0; j < column; j++) {
			row[getColumnName(j)] = getCellValue(i, j);
		}
		data.push(row);
	}
	return data;
}

function getColumnName(index: number): string {
	return `column${index}`;
}

function getCellValue(row: number, column: number): string {
	return `row ${row} column ${column}`;
}

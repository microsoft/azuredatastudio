/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';

suite('TableDataView Tests', () => {
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
		let rowCountEventParameter;
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
			assert.equal(rowCountEventInvokeCount, expectedRowCountChangeInvokeCount, 'RowCountChange event count - ' + stepName);
			if (verifyRowCountEventParameter) {
				assert.equal(rowCountEventParameter, expectedDataLength, 'Row count passed by RowCountChange event - ' + stepName);
			}
			assert.equal(obj.getLength(), expectedDataLength, 'Data length - ' + stepName);
			assert.equal(obj.getLengthNonFiltered(), expectedNonFilteredDataLength, 'Length for all data - ' + stepName);
			assert.equal(filterStateChangeEventInvokeCount, expectedFilterStateChangeInvokeCount, 'FilterStateChange event count - ' + stepName);
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
});

function populateData(row: number, column: number): any[] {
	let data = [];
	for (let i: number = 0; i < row; i++) {
		let row = {};
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
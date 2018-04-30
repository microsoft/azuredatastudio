/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Utils from 'sql/parts/connection/common/utils';

export class DBCellValue {
	displayValue: string;
	isNull: boolean;

	public static isDBCellValue(object: any): boolean {
		return (object !== undefined && object.displayValue !== undefined && object.isNull !== undefined);
	}
}

/**
 * Format xml field into a hyperlink and performs HTML entity encoding
 */
export function hyperLinkFormatter(row: number, cell: any, value: any, columnDef: any, dataContext: any): string {
	let cellClasses = 'grid-cell-value-container';
	let valueToDisplay: string = '';

	if (DBCellValue.isDBCellValue(value)) {
		valueToDisplay = 'NULL';
		if (!value.isNull) {
			cellClasses += ' xmlLink';
			valueToDisplay = Utils.htmlEntities(value.displayValue);
			return `<a class="${cellClasses}" href="#" >${valueToDisplay}</a>`;
		} else {
			cellClasses += ' missing-value';
		}
	}
	return `<span title="${valueToDisplay}" class="${cellClasses}">${valueToDisplay}</span>`;
}

/**
 * Format all text to replace all new lines with spaces and performs HTML entity encoding
 */
export function textFormatter(row: number, cell: any, value: any, columnDef: any, dataContext: any): string {
	let cellClasses = 'grid-cell-value-container';
	let valueToDisplay: string = '';

	if (DBCellValue.isDBCellValue(value)) {
		valueToDisplay = 'NULL';
		if (!value.isNull) {
			valueToDisplay = Utils.htmlEntities(value.displayValue.replace(/(\r\n|\n|\r)/g, ' '));
		} else {
			cellClasses += ' missing-value';
		}
	} else if (typeof value === 'string') {
		valueToDisplay = Utils.htmlEntities(value);
	}

	return `<span title="${valueToDisplay}" class="${cellClasses}">${valueToDisplay}</span>`;
}
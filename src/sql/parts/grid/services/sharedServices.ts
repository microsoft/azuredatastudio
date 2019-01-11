/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { escape } from 'sql/base/common/strings';

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
			valueToDisplay = escape(value.displayValue);
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
	let valueToDisplay = '';
	let titleValue = '';

	if (DBCellValue.isDBCellValue(value)) {
		valueToDisplay = 'NULL';
		if (!value.isNull) {
			valueToDisplay = value.displayValue.replace(/(\r\n|\n|\r)/g, ' ');
			valueToDisplay = escape(valueToDisplay.length > 250 ? valueToDisplay.slice(0, 250) + '...' : valueToDisplay);
			titleValue = valueToDisplay;
		} else {
			cellClasses += ' missing-value';
		}
	} else if (typeof value === 'string') {
		valueToDisplay = escape(value.length > 250 ? value.slice(0, 250) + '...' : value);
		titleValue = valueToDisplay;
	}

	return `<span title="${titleValue}" class="${cellClasses}">${valueToDisplay}</span>`;
}

/** The following code is a rewrite over the both formatter function using dom builder
 * rather than string manipulation, which is a safer and easier method of achieving the same goal.
 * However, when electron is in "Run as node" mode, dom creation acts differently than normal and therefore
 * the tests to test for html escaping fail. I'm keeping this code around as we should migrate to it if we ever
 * integrate into actual DOM testing (electron running in normal mode) later on.

export const hyperLinkFormatter: Slick.Formatter<any> = (row, cell, value, columnDef, dataContext): string => {
	let classes: Array<string> = ['grid-cell-value-container'];
	let displayValue = '';

	if (DBCellValue.isDBCellValue(value)) {
		if (!value.isNull) {
			displayValue = value.displayValue;
			classes.push('queryLink');
			let linkContainer = $('a', {
				class: classes.join(' '),
				title: displayValue
			});
			linkContainer.innerText = displayValue;
			return linkContainer.outerHTML;
		} else {
			classes.push('missing-value');
		}
	}

	let cellContainer = $('span', { class: classes.join(' '), title: displayValue });
	cellContainer.innerText = displayValue;
	return cellContainer.outerHTML;
};

export const textFormatter: Slick.Formatter<any> = (row, cell, value, columnDef, dataContext): string => {
	let displayValue = '';
	let classes: Array<string> = ['grid-cell-value-container'];

	if (DBCellValue.isDBCellValue(value)) {
		if (!value.isNull) {
			displayValue = value.displayValue.replace(/(\r\n|\n|\r)/g, ' ');
		} else {
			classes.push('missing-value');
			displayValue = 'NULL';
		}
	}

	let cellContainer = $('span', { class: classes.join(' '), title: displayValue });
	cellContainer.innerText = displayValue;

	return cellContainer.outerHTML;
};

*/

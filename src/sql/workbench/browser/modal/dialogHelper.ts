/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { Button } from 'sql/base/browser/ui/button/button';
import { append, $, addClass, addClasses } from 'vs/base/browser/dom';

import * as types from 'vs/base/common/types';

import * as azdata from 'azdata';

export function appendRow(container: HTMLElement, label: string, labelClass: string, cellContainerClass: string, rowContainerClass?: string | Array<string>): HTMLElement {
	let rowContainer = append(container, $('tr'));
	if (rowContainerClass) {
		if (types.isString(rowContainerClass)) {
			addClass(rowContainer, rowContainerClass);
		} else {
			addClasses(rowContainer, ...rowContainerClass);
		}
	}
	append(append(rowContainer, $(`td.${labelClass}`)), $('div')).innerText = label;
	let inputCellContainer = append(rowContainer, $(`td.${cellContainerClass}`));

	return inputCellContainer;
}

export function appendRowLink(container: HTMLElement, label: string, labelClass: string, cellContainerClass: string): HTMLElement {
	let rowContainer = append(container, $('tr'));
	append(append(rowContainer, $(`td.${labelClass}`)), $('div')).innerText = label;
	let buttonContainer = append(append(rowContainer, $(`td.${cellContainerClass}`)), $('div'));
	let rowButton = new Button(buttonContainer);

	return rowButton.element;
}

export function appendInputSelectBox(container: HTMLElement, selectBox: SelectBox): SelectBox {
	selectBox.render(container);
	return selectBox;
}

export function getBooleanValueFromStringOrBoolean(value: any): boolean {
	if (types.isBoolean(value)) {
		return value;
	} else if (types.isString(value)) {
		return value.toLowerCase() === 'true';
	}
	return false;
}

export function getCategoryDisplayName(categories: azdata.CategoryValue[], categoryName: string) {
	let displayName: string;
	categories.forEach(c => {
		if (c.name === categoryName) {
			displayName = c.displayName;
		}
	});
	return displayName;
}

export function getCategoryName(categories: azdata.CategoryValue[], categoryDisplayName: string) {
	let categoryName: string;
	categories.forEach(c => {
		if (c.displayName === categoryDisplayName) {
			categoryName = c.name;
		}
	});
	return categoryName;
}

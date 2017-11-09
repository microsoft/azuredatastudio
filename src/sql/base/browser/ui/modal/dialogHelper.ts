/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Builder } from 'vs/base/browser/builder';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { Button } from 'vs/base/browser/ui/button/button';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import * as data from 'data';
import * as types from 'vs/base/common/types';

export function appendRow(container: Builder, label: string, labelClass: string, cellContainerClass: string): Builder {
	let cellContainer: Builder;
	container.element('tr', {}, (rowContainer) => {
		rowContainer.element('td', { class: labelClass }, (labelCellContainer) => {
			labelCellContainer.div({}, (labelContainer) => {
				labelContainer.innerHtml(label);
			});
		});
		rowContainer.element('td', { class: cellContainerClass }, (inputCellContainer) => {
			cellContainer = inputCellContainer;
		});
	});

	return cellContainer;
}

export function appendRowLink(container: Builder, label: string, labelClass: string, cellContainerClass: string): Builder {
	let rowButton: Button;
	container.element('tr', {}, (rowContainer) => {
		rowContainer.element('td', { class: labelClass }, (labelCellContainer) => {
			labelCellContainer.div({}, (labelContainer) => {
				labelContainer.innerHtml(label);
			});
		});
		rowContainer.element('td', { class: cellContainerClass }, (inputCellContainer) => {
			inputCellContainer.element('div', {}, (rowContainer) => {
				rowButton = new Button(rowContainer);

			});
		});
	});

	return new Builder(rowButton.getElement());
}

export function createCheckBox(container: Builder, label: string, checkboxClass: string, isChecked: boolean, onCheck?: (viaKeyboard: boolean) => void): Checkbox {
	let checkbox = new Checkbox({
		actionClassName: checkboxClass,
		title: label,
		isChecked: isChecked,
		onChange: (viaKeyboard) => {
			if (onCheck) {
				onCheck(viaKeyboard);
			}
		}
	});
	container.getHTMLElement().appendChild(checkbox.domNode);
	container.div({}, (labelContainer) => {
		labelContainer.innerHtml(label);
	});

	return checkbox;
}

export function appendInputSelectBox(container: Builder, selectBox: SelectBox): SelectBox {
	selectBox.render(container.getHTMLElement());
	return selectBox;
}

export function isNullOrWhiteSpace(value: string): boolean {
	// returns true if the string is null or contains white space/tab chars only
	return !value || value.trim().length === 0;
}

export function getBooleanValueFromStringOrBoolean(value: any): boolean {
	if (types.isBoolean(value)) {
		return value;
	} else if (types.isString(value)) {
		return value.toLowerCase() === 'true';
	}
	return false;
}

export function getCategoryDisplayName(categories: data.CategoryValue[], categoryName: string) {
	var displayName: string;
	categories.forEach(c => {
		if (c.name === categoryName) {
			displayName = c.displayName;
		}
	});
	return displayName;
}

export function getCategoryName(categories: data.CategoryValue[], categoryDisplayName: string) {
	var categoryName: string;
	categories.forEach(c => {
		if (c.displayName === categoryDisplayName) {
			categoryName = c.name;
		}
	});
	return categoryName;
}
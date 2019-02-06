/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { Button } from 'sql/base/browser/ui/button/button';

import { Builder } from 'sql/base/browser/builder';
import * as types from 'vs/base/common/types';

import * as sqlops from 'sqlops';

export function appendRow(container: Builder, label: string, labelClass: string, cellContainerClass: string, rowContainerClass?: string): Builder {
	let cellContainer: Builder;
	let rowAttributes = rowContainerClass ? { class: rowContainerClass } : {};
	container.element('tr', rowAttributes, (rowContainer) => {
		rowContainer.element('td', { class: labelClass }, (labelCellContainer) => {
			labelCellContainer.div({}, (labelContainer) => {
				labelContainer.text(label);
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
				labelContainer.text(label);
			});
		});
		rowContainer.element('td', { class: cellContainerClass }, (inputCellContainer) => {
			inputCellContainer.element('div', {}, (rowContainer) => {
				rowButton = new Button(rowContainer.getHTMLElement());

			});
		});
	});

	return new Builder(rowButton.element);
}

export function appendInputSelectBox(container: Builder, selectBox: SelectBox): SelectBox {
	selectBox.render(container.getHTMLElement());
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

export function getCategoryDisplayName(categories: sqlops.CategoryValue[], categoryName: string) {
	var displayName: string;
	categories.forEach(c => {
		if (c.name === categoryName) {
			displayName = c.displayName;
		}
	});
	return displayName;
}

export function getCategoryName(categories: sqlops.CategoryValue[], categoryDisplayName: string) {
	var categoryName: string;
	categories.forEach(c => {
		if (c.displayName === categoryDisplayName) {
			categoryName = c.name;
		}
	});
	return categoryName;
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { Button } from 'sql/base/browser/ui/button/button';
import { append, $ } from 'vs/base/browser/dom';
import * as types from 'vs/base/common/types';
import * as azdata from 'azdata';
import { wrapStringWithNewLine } from 'sql/workbench/common/sqlWorkbenchUtils';
import { RequiredIndicatorClassName } from 'sql/base/browser/ui/label/label';
import { defaultButtonStyles } from 'vs/platform/theme/browser/defaultStyles';

export function appendRow(container: HTMLElement, label: string, labelClass: string, cellContainerClass: string, rowContainerClass?: string | Array<string>, showRequiredIndicator: boolean = false, title?: string, titleMaxWidth?: number): HTMLElement {
	let rowContainer = append(container, $('tr'));
	if (rowContainerClass) {
		if (types.isString(rowContainerClass)) {
			rowContainer.classList.add(rowContainerClass);
		} else {
			rowContainer.classList.add(...rowContainerClass);
		}
	}
	const labelContainer = append(append(rowContainer, $(`td.${labelClass}`)), $('div.dialog-label-container'));
	labelContainer.style.display = 'flex';

	if (title) {
		labelContainer.classList.add("info-icon");
		labelContainer.title = titleMaxWidth ? wrapStringWithNewLine(title, titleMaxWidth) : title;
	}

	append(labelContainer, $('div')).innerText = label;
	if (showRequiredIndicator) {
		labelContainer.classList.add(RequiredIndicatorClassName);
	}
	let inputCellContainer = append(rowContainer, $(`td.${cellContainerClass}`));

	return inputCellContainer;
}

export function appendRowLink(container: HTMLElement, label: string, labelClass: string, cellContainerClass: string): HTMLElement {
	let rowContainer = append(container, $('tr'));
	append(append(rowContainer, $(`td.${labelClass}`)), $('div')).innerText = label;
	let buttonContainer = append(append(rowContainer, $(`td.${cellContainerClass}`)), $('div'));
	let rowButton = new Button(buttonContainer, defaultButtonStyles);

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

export function getCategoryDisplayName(categories: azdata.CategoryValue[], categoryName: string): string | undefined {
	let displayName: string | undefined;
	categories.forEach(c => {
		if (c.name === categoryName) {
			displayName = c.displayName;
		}
	});
	return displayName;
}

export function getCategoryName(categories: azdata.CategoryValue[], categoryDisplayName: string): string | undefined {
	let categoryName: string | undefined;
	categories.forEach(c => {
		if (c.displayName === categoryDisplayName) {
			categoryName = c.name;
		}
	});
	return categoryName;
}

export function getOptionContainerByName(parentContainer: HTMLElement, optionName: string): HTMLElement | undefined {
	for (let i = 0; i < parentContainer.childElementCount; i++) {
		if (parentContainer.children.item(i).classList.contains(`option-${optionName}`)) {
			return parentContainer.children.item(i).children.item(0).children.item(0) as HTMLElement;
		}
	}
	return undefined;
}

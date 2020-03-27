/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DialogHelper from './dialogHelper';
import { SelectBox, SelectOptionItemSQL } from 'sql/base/browser/ui/selectBox/selectBox';
import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import * as types from 'vs/base/common/types';
import * as azdata from 'azdata';
import { localize } from 'vs/nls';
import { startsWith } from 'vs/base/common/strings';
import { ServiceOptionType } from 'sql/platform/connection/common/interfaces';

export interface IOptionElement {
	optionWidget: any;
	option: azdata.ServiceOption;
	optionValue: any;
}

export function createOptionElement(option: azdata.ServiceOption, rowContainer: HTMLElement, options: { [name: string]: any },
	optionsMap: { [optionName: string]: IOptionElement }, contextViewService: IContextViewService, onFocus: (name) => void): IOptionElement {
	let possibleInputs: SelectOptionItemSQL[] = [];
	let optionValue = getOptionValueAndCategoryValues(option, options, possibleInputs);
	let optionWidget: any;
	let inputElement: HTMLElement;
	let missingErrorMessage = localize('optionsDialog.missingRequireField', " is required.");
	let invalidInputMessage = localize('optionsDialog.invalidInput', "Invalid input.  Numeric value expected.");

	if (option.valueType === ServiceOptionType.number) {
		optionWidget = new InputBox(rowContainer, contextViewService, {
			validationOptions: {
				validation: (value: string) => {
					if (!value && option.isRequired) {
						return { type: MessageType.ERROR, content: option.displayName + missingErrorMessage };
					} else if (!types.isNumber(Number(value))) {
						return { type: MessageType.ERROR, content: invalidInputMessage };
					} else {
						return null;
					}
				}
			},
			ariaLabel: option.displayName
		});
		optionWidget.value = optionValue;
		inputElement = findElement(rowContainer, 'input');
	} else if (option.valueType === ServiceOptionType.category || option.valueType === ServiceOptionType.boolean) {
		optionWidget = new SelectBox(possibleInputs, optionValue.toString(), contextViewService, undefined, { ariaLabel: option.displayName });
		DialogHelper.appendInputSelectBox(rowContainer, optionWidget);
		inputElement = findElement(rowContainer, 'monaco-select-box');
	} else if (option.valueType === ServiceOptionType.string || option.valueType === ServiceOptionType.password) {
		optionWidget = new InputBox(rowContainer, contextViewService, {
			validationOptions: {
				validation: (value: string) => (!value && option.isRequired) ? ({ type: MessageType.ERROR, content: option.displayName + missingErrorMessage }) : null
			},
			ariaLabel: option.displayName
		});
		optionWidget.value = optionValue;
		if (option.valueType === ServiceOptionType.password) {
			optionWidget.inputElement.type = 'password';
		}
		inputElement = findElement(rowContainer, 'input');
	}
	const optionElement = { optionWidget: optionWidget, option: option, optionValue: optionValue };
	optionsMap[option.name] = optionElement;
	inputElement.onfocus = () => onFocus(option.name);
	return optionElement;
}

export function getOptionValueAndCategoryValues(option: azdata.ServiceOption, options: { [optionName: string]: any }, possibleInputs: SelectOptionItemSQL[]): any {
	let optionValue = option.defaultValue;
	if (options[option.name] !== undefined) {
		// if the value type is boolean, the option value can be either boolean or string
		if (option.valueType === ServiceOptionType.boolean) {
			if (options[option.name] === true || options[option.name] === trueInputValue) {
				optionValue = trueInputValue;
			} else {
				optionValue = falseInputValue;
			}
		} else {
			optionValue = options[option.name];
		}
	}

	if (option.valueType === ServiceOptionType.boolean || option.valueType === ServiceOptionType.category) {
		// If the option is not required, the empty string should be add at the top of possible choices
		if (!option.isRequired) {
			possibleInputs.push({ text: '', value: '' });
		}

		if (option.valueType === ServiceOptionType.boolean) {
			possibleInputs.push({ text: trueInputValue, value: trueInputValue }, { text: falseInputValue, value: falseInputValue });
		} else {
			option.categoryValues.forEach(c => possibleInputs.push({ text: c.displayName, value: c.name }));
		}

		// If the option value is not set and default value is null, the option value should be set to the first possible input.
		if (optionValue === null || optionValue === undefined) {
			optionValue = possibleInputs[0].text;
		}
	}
	return optionValue;
}

export function validateInputs(optionsMap: { [optionName: string]: IOptionElement }): boolean {
	let isValid = true;
	let isFocused = false;
	for (let optionName in optionsMap) {
		let optionElement: IOptionElement = optionsMap[optionName];
		let widget = optionElement.optionWidget;
		let isInputBox = (optionElement.option.valueType === ServiceOptionType.string ||
			optionElement.option.valueType === ServiceOptionType.password ||
			optionElement.option.valueType === ServiceOptionType.number);

		if (isInputBox) {
			if (!widget.validate()) {
				isValid = false;
				if (!isFocused) {
					isFocused = true;
					widget.focus();
				}
			}
		}
	}
	return isValid;
}

export function updateOptions(options: { [optionName: string]: any }, optionsMap: { [optionName: string]: IOptionElement }): void {
	for (let optionName in optionsMap) {
		let optionElement: IOptionElement = optionsMap[optionName];
		if (optionElement.optionWidget.value !== options[optionName]) {
			if (!optionElement.optionWidget.value && options[optionName]) {
				delete options[optionName];
			}
			if (optionElement.optionWidget.value) {
				if (optionElement.option.valueType === ServiceOptionType.boolean) {
					options[optionName] = (optionElement.optionWidget.value === trueInputValue) ? true : false;
				} else {
					options[optionName] = optionElement.optionWidget.value;
				}
			}
			optionElement.optionValue = options[optionName];
		}
	}
}

export let trueInputValue: string = 'True';
export let falseInputValue: string = 'False';

export function findElement(container: HTMLElement, className: string): HTMLElement {
	let elementBuilder = container;
	while (elementBuilder) {
		let htmlElement = elementBuilder;
		if (startsWith(htmlElement.className, className)) {
			break;
		}
		elementBuilder = elementBuilder.firstChild as HTMLElement;
	}
	return elementBuilder;
}

export function groupOptionsByCategory(options: azdata.ServiceOption[]): { [category: string]: azdata.ServiceOption[] } {
	let connectionOptionsMap: { [category: string]: azdata.ServiceOption[] } = {};
	options.forEach(option => {
		let groupName = option.groupName;
		if (groupName === null || groupName === undefined) {
			groupName = 'General';
		}

		if (!!connectionOptionsMap[groupName]) {
			connectionOptionsMap[groupName].push(option);
		} else {
			connectionOptionsMap[groupName] = [option];
		}
	});
	return connectionOptionsMap;
}

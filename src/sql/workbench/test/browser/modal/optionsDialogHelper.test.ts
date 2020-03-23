/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as OptionsDialogHelper from 'sql/workbench/browser/modal/optionsDialogHelper';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { $ } from 'vs/base/browser/dom';
import { SelectOptionItemSQL } from 'sql/base/browser/ui/selectBox/selectBox';

suite('Advanced options helper tests', () => {
	let possibleInputs: SelectOptionItemSQL[];
	let options: { [name: string]: any };
	let categoryOption: azdata.ServiceOption;
	let booleanOption: azdata.ServiceOption;
	let numberOption: azdata.ServiceOption;
	let stringOption: azdata.ServiceOption;
	let defaultGroupOption: azdata.ServiceOption;
	let isValid: boolean;
	let inputValue: string;
	let inputBox: TypeMoq.Mock<InputBox>;

	let optionsMap: { [optionName: string]: OptionsDialogHelper.IOptionElement };

	setup(() => {
		options = {};
		optionsMap = {};

		categoryOption = {
			name: 'applicationIntent',
			displayName: 'Application Intent',
			description: 'Declares the application workload type when connecting to a server',
			groupName: 'Initialization',
			categoryValues: [
				{ displayName: 'ReadWrite', name: 'RW' },
				{ displayName: 'ReadOnly', name: 'RO' }
			],
			defaultValue: null,
			isRequired: false,
			valueType: ServiceOptionType.category,
			objectType: undefined,
			isArray: undefined
		};

		booleanOption = {
			name: 'asynchronousProcessing',
			displayName: 'Asynchronous processing enabled',
			description: 'When true, enables usage of the Asynchronous functionality in the .Net Framework Data Provider',
			groupName: 'Initialization',
			categoryValues: null,
			defaultValue: null,
			isRequired: false,
			valueType: ServiceOptionType.boolean,
			objectType: undefined,
			isArray: undefined
		};

		numberOption = {
			name: 'connectTimeout',
			displayName: 'Connect Timeout',
			description: 'The length of time (in seconds) to wait for a connection to the server before terminating the attempt and generating an error',
			groupName: 'Initialization',
			categoryValues: null,
			defaultValue: '15',
			isRequired: false,
			valueType: ServiceOptionType.number,
			objectType: undefined,
			isArray: undefined
		};

		stringOption = {
			name: 'currentLanguage',
			displayName: 'Current Language',
			description: 'The SQL Server language record name',
			groupName: 'Initialization',
			categoryValues: null,
			defaultValue: null,
			isRequired: false,
			valueType: ServiceOptionType.string,
			objectType: undefined,
			isArray: undefined
		};

		defaultGroupOption = {
			name: 'defaultGroupOption',
			displayName: 'Default Group',
			description: 'Test string option',
			groupName: undefined,
			categoryValues: null,
			defaultValue: null,
			isRequired: false,
			valueType: ServiceOptionType.string,
			objectType: undefined,
			isArray: undefined
		};

		inputBox = TypeMoq.Mock.ofType(InputBox, TypeMoq.MockBehavior.Loose, $('div'), null, null);
		inputBox.callBase = true;
		inputBox.setup(x => x.validate()).returns(() => isValid);
		inputBox.setup(x => x.value).returns(() => inputValue);
	});

	test('create default but not required category options should set the option value and possible inputs correctly', () => {
		categoryOption.defaultValue = 'ReadWrite';
		categoryOption.isRequired = false;
		possibleInputs = [];
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(categoryOption, options, possibleInputs);
		assert.equal(optionValue, 'ReadWrite');
		assert.equal(possibleInputs.length, 3);
		assert.equal(possibleInputs[0].text, '');
		assert.equal(possibleInputs[1].text, 'ReadWrite');
		assert.equal(possibleInputs[2].text, 'ReadOnly');
		assert.equal(possibleInputs[0].value, '');
		assert.equal(possibleInputs[1].value, 'RW');
		assert.equal(possibleInputs[2].value, 'RO');
	});

	test('create default and required category options should set the option value and possible inputs correctly', () => {
		categoryOption.defaultValue = 'ReadWrite';
		categoryOption.isRequired = true;
		possibleInputs = [];
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(categoryOption, options, possibleInputs);
		assert.equal(optionValue, 'ReadWrite');
		assert.equal(possibleInputs.length, 2);
		assert.equal(possibleInputs[0].text, 'ReadWrite');
		assert.equal(possibleInputs[1].text, 'ReadOnly');
	});

	test('create no default and not required category options should set the option value and possible inputs correctly', () => {
		categoryOption.defaultValue = null;
		categoryOption.isRequired = false;
		possibleInputs = [];
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(categoryOption, options, possibleInputs);
		assert.equal(optionValue, '');
		assert.equal(possibleInputs.length, 3);
		assert.equal(possibleInputs[0].text, '');
		assert.equal(possibleInputs[1].text, 'ReadWrite');
		assert.equal(possibleInputs[2].text, 'ReadOnly');
	});

	test('create no default but required category options should set the option value and possible inputs correctly', () => {
		categoryOption.defaultValue = null;
		categoryOption.isRequired = true;
		possibleInputs = [];
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(categoryOption, options, possibleInputs);
		assert.equal(optionValue, 'ReadWrite');
		assert.equal(possibleInputs.length, 2);
		assert.equal(possibleInputs[0].text, 'ReadWrite');
		assert.equal(possibleInputs[1].text, 'ReadOnly');
	});

	test('create not required category options with option value should set the option value and possible inputs correctly', () => {
		categoryOption.defaultValue = null;
		categoryOption.isRequired = false;
		possibleInputs = [];
		options['applicationIntent'] = 'ReadOnly';
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(categoryOption, options, possibleInputs);
		assert.equal(optionValue, 'ReadOnly');
		assert.equal(possibleInputs.length, 3);
		assert.equal(possibleInputs[0].text, '');
		assert.equal(possibleInputs[1].text, 'ReadWrite');
		assert.equal(possibleInputs[2].text, 'ReadOnly');
	});

	test('create required category options with option value should set the option value and possible inputs correctly', () => {
		categoryOption.defaultValue = null;
		categoryOption.isRequired = true;
		possibleInputs = [];
		options['applicationIntent'] = 'ReadOnly';
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(categoryOption, options, possibleInputs);
		assert.equal(optionValue, 'ReadOnly');
		assert.equal(possibleInputs.length, 2);
		assert.equal(possibleInputs[0].text, 'ReadWrite');
		assert.equal(possibleInputs[1].text, 'ReadOnly');
	});

	test('create default but not required boolean options should set the option value and possible inputs correctly', () => {
		booleanOption.defaultValue = 'False';
		booleanOption.isRequired = false;
		possibleInputs = [];
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(booleanOption, options, possibleInputs);
		assert.equal(optionValue, 'False');
		assert.equal(possibleInputs.length, 3);
		assert.equal(possibleInputs[0].text, '');
		assert.equal(possibleInputs[1].text, 'True');
		assert.equal(possibleInputs[2].text, 'False');
	});

	test('create default and required boolean options should set the option value and possible inputs correctly', () => {
		booleanOption.defaultValue = 'False';
		booleanOption.isRequired = true;
		possibleInputs = [];
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(booleanOption, options, possibleInputs);
		assert.equal(optionValue, 'False');
		assert.equal(possibleInputs.length, 2);
		assert.equal(possibleInputs[0].text, 'True');
		assert.equal(possibleInputs[1].text, 'False');
	});

	test('create no default and not required boolean options should set the option value and possible inputs correctly', () => {
		booleanOption.defaultValue = null;
		booleanOption.isRequired = false;
		possibleInputs = [];
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(booleanOption, options, possibleInputs);
		assert.equal(optionValue, '');
		assert.equal(possibleInputs.length, 3);
		assert.equal(possibleInputs[0].text, '');
		assert.equal(possibleInputs[1].text, 'True');
		assert.equal(possibleInputs[2].text, 'False');
	});

	test('create no default but required boolean options should set the option value and possible inputs correctly', () => {
		booleanOption.defaultValue = null;
		booleanOption.isRequired = true;
		possibleInputs = [];
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(booleanOption, options, possibleInputs);
		assert.equal(optionValue, 'True');
		assert.equal(possibleInputs.length, 2);
		assert.equal(possibleInputs[0].text, 'True');
		assert.equal(possibleInputs[1].text, 'False');
	});

	test('create not required boolean options with option value should set the option value and possible inputs correctly', () => {
		booleanOption.defaultValue = null;
		booleanOption.isRequired = false;
		possibleInputs = [];
		options['asynchronousProcessing'] = true;
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(booleanOption, options, possibleInputs);
		assert.equal(optionValue, 'True');
		assert.equal(possibleInputs.length, 3);
		assert.equal(possibleInputs[0].text, '');
		assert.equal(possibleInputs[1].text, 'True');
		assert.equal(possibleInputs[2].text, 'False');
	});

	test('create required boolean options with option value should set the option value and possible inputs correctly', () => {
		booleanOption.defaultValue = null;
		booleanOption.isRequired = true;
		possibleInputs = [];
		options['asynchronousProcessing'] = 'False';
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(booleanOption, options, possibleInputs);
		assert.equal(optionValue, 'False');
		assert.equal(possibleInputs.length, 2);
		assert.equal(possibleInputs[0].text, 'True');
		assert.equal(possibleInputs[1].text, 'False');
	});

	test('create default number options should set the option value and possible inputs correctly', () => {
		numberOption.defaultValue = '15';
		numberOption.isRequired = true;
		possibleInputs = [];
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(numberOption, options, possibleInputs);
		assert.equal(optionValue, '15');
	});

	test('create number options with option value should set the option value and possible inputs correctly', () => {
		numberOption.defaultValue = '15';
		numberOption.isRequired = false;
		possibleInputs = [];
		options['connectTimeout'] = '45';
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(numberOption, options, possibleInputs);
		assert.equal(optionValue, '45');
	});

	test('create default string options should set the option value and possible inputs correctly', () => {
		stringOption.defaultValue = 'Japanese';
		stringOption.isRequired = true;
		possibleInputs = [];
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(stringOption, options, possibleInputs);
		assert.equal(optionValue, 'Japanese');
	});

	test('create string options with option value should set the option value and possible inputs correctly', () => {
		stringOption.defaultValue = 'Japanese';
		stringOption.isRequired = false;
		possibleInputs = [];
		options['currentLanguage'] = 'Spanish';
		let optionValue = OptionsDialogHelper.getOptionValueAndCategoryValues(stringOption, options, possibleInputs);
		assert.equal(optionValue, 'Spanish');
	});

	test('validate undefined and optional number input should return no error', () => {
		isValid = true;
		inputValue = '';
		numberOption.isRequired = false;
		optionsMap = {};
		optionsMap['connectTimeout'] = {
			optionWidget: inputBox.object,
			option: numberOption,
			optionValue: null
		};

		let error = OptionsDialogHelper.validateInputs(optionsMap);
		assert.equal(error, true);
	});

	test('validate a valid optional number input should return no error', () => {
		isValid = true;
		inputValue = '30';
		numberOption.isRequired = false;
		optionsMap = {};
		optionsMap['connectTimeout'] = {
			optionWidget: inputBox.object,
			option: numberOption,
			optionValue: null
		};

		let error = OptionsDialogHelper.validateInputs(optionsMap);
		assert.equal(error, true);
	});

	test('validate a valid required number input should return no error', () => {
		isValid = true;
		inputValue = '30';
		numberOption.isRequired = true;
		optionsMap = {};
		optionsMap['connectTimeout'] = {
			optionWidget: inputBox.object,
			option: numberOption,
			optionValue: null
		};
		let error = OptionsDialogHelper.validateInputs(optionsMap);
		assert.equal(error, true);
	});

	test('validate invalid optional number option should return an expected error', () => {
		isValid = false;
		inputValue = 'abc';
		numberOption.isRequired = false;
		optionsMap = {};
		optionsMap['connectTimeout'] = {
			optionWidget: inputBox.object,
			option: numberOption,
			optionValue: null
		};

		let error = OptionsDialogHelper.validateInputs(optionsMap);
		assert.equal(error, false);
	});

	test('validate required optional number option should return an expected error', () => {
		isValid = false;
		inputValue = '';
		numberOption.isRequired = true;
		optionsMap = {};
		optionsMap['connectTimeout'] = {
			optionWidget: inputBox.object,
			option: numberOption,
			optionValue: null
		};

		let error = OptionsDialogHelper.validateInputs(optionsMap);
		assert.equal(error, false);
	});

	test('update options should delete option entry if the input value is an empty string', () => {
		isValid = true;
		inputValue = '';
		numberOption.isRequired = false;
		optionsMap = {};
		optionsMap['connectTimeout'] = {
			optionWidget: inputBox.object,
			option: numberOption,
			optionValue: '45'
		};
		options['connectTimeout'] = '45';
		OptionsDialogHelper.updateOptions(options, optionsMap);
		assert.equal(options['connectTimeout'], undefined);
	});

	test('update options should update correct option value', () => {
		isValid = true;
		inputValue = '50';
		numberOption.isRequired = false;
		optionsMap = {};
		optionsMap['connectTimeout'] = {
			optionWidget: inputBox.object,
			option: numberOption,
			optionValue: '45'
		};
		options['connectTimeout'] = '45';
		OptionsDialogHelper.updateOptions(options, optionsMap);
		assert.equal(options['connectTimeout'], 50);
	});

	test('update options should add the option value to options', () => {
		isValid = true;
		inputValue = '50';
		numberOption.isRequired = false;
		optionsMap = {};
		optionsMap['connectTimeout'] = {
			optionWidget: inputBox.object,
			option: numberOption,
			optionValue: '45'
		};
		options = {};
		OptionsDialogHelper.updateOptions(options, optionsMap);
		assert.equal(options['connectTimeout'], 50);
	});

	test('groupOptionsByCategory converts a list of options to a map of category names to lists of options', () => {
		let optionsList = [categoryOption, booleanOption, numberOption, stringOption, defaultGroupOption];
		let optionsMap = OptionsDialogHelper.groupOptionsByCategory(optionsList);
		let categoryNames = Object.keys(optionsMap);
		assert.equal(categoryNames.some(x => x === 'Initialization'), true);
		assert.equal(categoryNames.some(x => x === 'General'), true);
		assert.equal(categoryNames.length, 2);
		assert.equal(optionsMap['Initialization'].length, 4);
		assert.equal(optionsMap['General'].length, 1);
	});

});

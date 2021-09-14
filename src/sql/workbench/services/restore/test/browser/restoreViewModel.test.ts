/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as assert from 'assert';
import { RestoreViewModel } from 'sql/workbench/services/restore/browser/restoreViewModel';
import { ServiceOptionType } from 'sql/platform/connection/common/interfaces';

suite('Restore Dialog view model tests', () => {
	let option1String = 'option1';
	let option2Category = 'option2';
	let option3Boolean = 'option3';
	let options: { [name: string]: any };
	let stringServiceOption: azdata.ServiceOption;
	let categoryServiceOption: azdata.ServiceOption;
	let booleanServiceOption: azdata.ServiceOption;

	let viewModel: RestoreViewModel;

	let planDetails: { [key: string]: azdata.RestorePlanDetailInfo };
	let backupSets: azdata.DatabaseFileInfo[];

	setup(() => {
		options = {};
		planDetails = {};
		backupSets = [];
		planDetails['lastBackupTaken'] = {
			name: 'lastBackupTaken',
			currentValue: '8/16/2017',
			isReadOnly: true,
			isVisible: true,
			defaultValue: null
		};

		planDetails['targetDatabaseName'] = {
			name: 'targetDatabaseName',
			currentValue: 'db1',
			isReadOnly: true,
			isVisible: true,
			defaultValue: 'db1'
		};

		planDetails['sourceDatabaseName'] = {
			name: 'sourceDatabaseName',
			currentValue: 'dbSource',
			isReadOnly: true,
			isVisible: true,
			defaultValue: 'dbSource'
		};

		planDetails[option1String] = {
			name: option1String,
			currentValue: 'newOptionValue',
			isReadOnly: true,
			isVisible: true,
			defaultValue: 'newDefault'
		};

		backupSets.push(
			{
				properties: [],
				id: 'file1',
				isSelected: false
			},
			{
				properties: [],
				id: 'file2',
				isSelected: true
			});

		stringServiceOption = {
			name: option1String,
			displayName: 'Option 1',
			description: null!,
			groupName: null!,
			valueType: ServiceOptionType.string,
			defaultValue: 'default',
			objectType: null!,
			categoryValues: null!,
			isRequired: false,
			isArray: false
		};

		categoryServiceOption = {
			name: option2Category,
			displayName: 'Option 2',
			description: null!,
			groupName: null!,
			valueType: ServiceOptionType.category,
			defaultValue: 'catagory1',
			objectType: null!,
			categoryValues: [{
				displayName: 'Catagory 1',
				name: 'catagory1'
			},
			{
				displayName: 'Catagory 2',
				name: 'catagory2'
			}],
			isRequired: false,
			isArray: false
		};

		booleanServiceOption = {
			name: option3Boolean,
			displayName: 'Option 3',
			description: null!,
			groupName: null!,
			valueType: ServiceOptionType.boolean,
			defaultValue: 'true',
			objectType: null!,
			categoryValues: null!,
			isRequired: false,
			isArray: false
		};
		viewModel = new RestoreViewModel([booleanServiceOption, categoryServiceOption, stringServiceOption]);
	});

	test('get boolean option type should return correct display value', () => {
		let falseStringOptionValue = 'False';
		assert.strictEqual(false, viewModel.getDisplayValue(booleanServiceOption, falseStringOptionValue));

		let falseBooleanOptionValue = false;
		assert.strictEqual(false, viewModel.getDisplayValue(booleanServiceOption, falseBooleanOptionValue));

		let trueStringOptionValue = 'true';
		assert.strictEqual(true, viewModel.getDisplayValue(booleanServiceOption, trueStringOptionValue));

		let undefinedOptionValue = undefined;
		assert.strictEqual(false, viewModel.getDisplayValue(booleanServiceOption, undefinedOptionValue));
	});

	test('get category option type should return correct display value', () => {
		let categoryOptionValue = 'catagory2';
		assert.strictEqual('Catagory 2', viewModel.getDisplayValue(categoryServiceOption, categoryOptionValue));

		let undefinedOptionValue = undefined;
		assert.strictEqual('Catagory 1', viewModel.getDisplayValue(categoryServiceOption, undefinedOptionValue));
	});

	test('get string option type should return correct display value', () => {
		let stringOptionValue = 'string1';
		assert.strictEqual(stringOptionValue, viewModel.getDisplayValue(stringServiceOption, stringOptionValue));

		let undefinedOptionValue = undefined;
		assert.strictEqual('', viewModel.getDisplayValue(stringServiceOption, undefinedOptionValue));
	});

	test('get option meta data should return the correct one', () => {
		assert.strictEqual(stringServiceOption, viewModel.getOptionMetadata(option1String));
		assert.strictEqual(categoryServiceOption, viewModel.getOptionMetadata(option2Category));
		assert.strictEqual(booleanServiceOption, viewModel.getOptionMetadata(option3Boolean));
		assert.strictEqual(undefined, viewModel.getOptionMetadata('option4'));
	});

	test('get restore advanced option should return the only the options that have been changed and are different from the default value', () => {
		viewModel.setOptionValue(option1String, 'default');
		viewModel.setOptionValue(option2Category, 'Catagory 2');
		viewModel.setOptionValue(option3Boolean, false);
		options = {};
		viewModel.getRestoreAdvancedOptions(options);
		assert.strictEqual(undefined, options[option1String]);
		assert.strictEqual('catagory2', options[option2Category]);
		assert.strictEqual(false, options[option3Boolean]);
	});

	test('on restore plan response should update all options from restore plan response correctly', () => {
		let restorePlanResponse: azdata.RestorePlanResponse = {
			sessionId: '123',
			backupSetsToRestore: backupSets,
			canRestore: true,
			dbFiles: [],
			databaseNamesFromBackupSets: ['dbSource', 'dbSource2'],
			planDetails: planDetails
		};

		viewModel.onRestorePlanResponse(restorePlanResponse);

		// verify that source database, target databasem and last backup get set correctly
		assert.strictEqual('dbSource', viewModel.sourceDatabaseName);
		assert.strictEqual('db1', viewModel.targetDatabaseName);
		assert.strictEqual('8/16/2017', viewModel.lastBackupTaken);

		// verify that advanced options get set correctly
		options = {};
		viewModel.getRestoreAdvancedOptions(options);
		assert.strictEqual('newOptionValue', options[option1String]);

		// verify that selected backup sets get set correctly
		let selectedBackupSets = viewModel.selectedBackupSets;
		assert.strictEqual(1, selectedBackupSets!.length);
		assert.strictEqual('file2', selectedBackupSets![0]);
	});


	test('on reset restore options should reset all options', () => {
		let restorePlanResponse: azdata.RestorePlanResponse = {
			sessionId: '123',
			backupSetsToRestore: backupSets,
			canRestore: true,
			dbFiles: [],
			databaseNamesFromBackupSets: ['dbSource', 'dbSource2'],
			planDetails: planDetails
		};
		viewModel.filePath = 'filepath1';
		viewModel.onRestorePlanResponse(restorePlanResponse);

		//reset restore options
		viewModel.resetRestoreOptions('db2');

		// verify that file path, source database, target databasem and last backup get set correctly
		assert.strictEqual('', viewModel.lastBackupTaken);
		assert.strictEqual('db2', viewModel.sourceDatabaseName);
		assert.strictEqual('db2', viewModel.targetDatabaseName);
		assert.strictEqual('', viewModel.lastBackupTaken);
		assert.strictEqual(0, viewModel.databaseList!.length);

		// verify that advanced options get set correctly
		options = {};
		viewModel.getRestoreAdvancedOptions(options);
		assert.strictEqual(undefined, options[option1String]);

		// verify that selected backup sets get set correctly
		let selectedBackupSets = viewModel.selectedBackupSets;
		assert.strictEqual(undefined, selectedBackupSets);
	});

	test('update options with config info should update option correctly', () => {
		let databaseList = ['db1', 'db2'];
		let configInfo: { [key: string]: any } = {};
		configInfo['sourceDatabaseNamesWithBackupSets'] = databaseList;
		configInfo[option1String] = 'option1 from config info';
		viewModel.updateOptionWithConfigInfo(configInfo);
		assert.ok(viewModel.databaseList);
		assert.strictEqual(3, viewModel.databaseList!.length);
		assert.strictEqual('', viewModel.databaseList![0]);
		assert.strictEqual(databaseList[1], viewModel.databaseList![1]);
		assert.strictEqual(databaseList[2], viewModel.databaseList![2]);
		assert.strictEqual('option1 from config info', viewModel.getOptionValue(option1String));

		// verify that the options from get restore advanced options doesn't contain option1String
		options = {};
		viewModel.getRestoreAdvancedOptions(options);
		assert.strictEqual(undefined, options[option1String]);
	});

	test('on restore from changed should set readHeaderFromMedia and reset the source database names and selected database name correctly', () => {
		viewModel.databaseList = ['', 'db1', 'db2'];
		viewModel.sourceDatabaseName = 'sourceDatabase';
		viewModel.filePath = 'filepath';
		viewModel.readHeaderFromMedia = false;
		viewModel.onRestoreFromChanged(true);
		assert.strictEqual(true, viewModel.readHeaderFromMedia);
		assert.strictEqual(undefined, viewModel.sourceDatabaseName);
		assert.strictEqual('', viewModel.filePath);

		viewModel.sourceDatabaseName = 'sourceDatabase2';
		viewModel.onRestoreFromChanged(false);
		assert.strictEqual(false, viewModel.readHeaderFromMedia);
		assert.strictEqual('', viewModel.sourceDatabaseName);
	});
});

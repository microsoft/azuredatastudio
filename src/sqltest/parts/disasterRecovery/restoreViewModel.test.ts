/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as assert from 'assert';
import { RestoreViewModel } from 'sql/parts/disasterRecovery/restore/restoreViewModel';
import { ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';

suite('Restore Dialog view model tests', () => {
	let option1String = 'option1';
	let option2Category = 'option2';
	let option3Boolean = 'option3';
	let options: { [name: string]: any };
	let stringServiceOption: sqlops.ServiceOption;
	let categoryServiceOption: sqlops.ServiceOption;
	let booleanServiceOption: sqlops.ServiceOption;

	let viewModel: RestoreViewModel;

	let planDetails: { [key: string]: sqlops.RestorePlanDetailInfo };
	let backupSets: sqlops.DatabaseFileInfo[];

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
			description: null,
			groupName: null,
			valueType: ServiceOptionType.string,
			defaultValue: 'default',
			objectType: null,
			categoryValues: null,
			isRequired: false,
			isArray: false
		};

		categoryServiceOption = {
			name: option2Category,
			displayName: 'Option 2',
			description: null,
			groupName: null,
			valueType: ServiceOptionType.category,
			defaultValue: 'catagory1',
			objectType: null,
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
			description: null,
			groupName: null,
			valueType: ServiceOptionType.boolean,
			defaultValue: 'true',
			objectType: null,
			categoryValues: null,
			isRequired: false,
			isArray: false
		};
		viewModel = new RestoreViewModel([booleanServiceOption, categoryServiceOption, stringServiceOption]);
	});

	test('get boolean option type should return correct display value', () => {
		let falseStringOptionValue = 'False';
		assert.equal(false, viewModel.getDisplayValue(booleanServiceOption, falseStringOptionValue));

		let falseBooleanOptionValue = false;
		assert.equal(false, viewModel.getDisplayValue(booleanServiceOption, falseBooleanOptionValue));

		let trueStringOptionValue = 'true';
		assert.equal(true, viewModel.getDisplayValue(booleanServiceOption, trueStringOptionValue));

		let undefinedOptionValue = undefined;
		assert.equal(false, viewModel.getDisplayValue(booleanServiceOption, undefinedOptionValue));
	});

	test('get category option type should return correct display value', () => {
		let categoryOptionValue = 'catagory2';
		assert.equal('Catagory 2', viewModel.getDisplayValue(categoryServiceOption, categoryOptionValue));

		let undefinedOptionValue = undefined;
		assert.equal('Catagory 1', viewModel.getDisplayValue(categoryServiceOption, undefinedOptionValue));
	});

	test('get string option type should return correct display value', () => {
		let stringOptionValue = 'string1';
		assert.equal(stringOptionValue, viewModel.getDisplayValue(stringServiceOption, stringOptionValue));

		let undefinedOptionValue = undefined;
		assert.equal('', viewModel.getDisplayValue(stringServiceOption, undefinedOptionValue));
	});

	test('get option meta data should return the correct one', () => {
		assert.equal(stringServiceOption, viewModel.getOptionMetadata(option1String));
		assert.equal(categoryServiceOption, viewModel.getOptionMetadata(option2Category));
		assert.equal(booleanServiceOption, viewModel.getOptionMetadata(option3Boolean));
		assert.equal(undefined, viewModel.getOptionMetadata('option4'));
	});

	test('get restore advanced option should return the only the options that have been changed and are different from the default value', () => {
		viewModel.setOptionValue(option1String, 'default');
		viewModel.setOptionValue(option2Category, 'Catagory 2');
		viewModel.setOptionValue(option3Boolean, false);
		options = {};
		viewModel.getRestoreAdvancedOptions(options);
		assert.equal(undefined, options[option1String]);
		assert.equal('catagory2', options[option2Category]);
		assert.equal(false, options[option3Boolean]);
	});

	test('on restore plan response should update all options from restore plan response correctly', () => {
		let restorePlanResponse: sqlops.RestorePlanResponse = {
			sessionId: '123',
			backupSetsToRestore: backupSets,
			canRestore: true,
			errorMessage: null,
			dbFiles: [],
			databaseNamesFromBackupSets: ['dbSource', 'dbSource2'],
			planDetails: planDetails
		};

		viewModel.onRestorePlanResponse(restorePlanResponse);

		// verify that source database, target databasem and last backup get set correctly
		assert.equal('dbSource', viewModel.sourceDatabaseName);
		assert.equal('db1', viewModel.targetDatabaseName);
		assert.equal('8/16/2017', viewModel.lastBackupTaken);

		// verify that advanced options get set correctly
		options = {};
		viewModel.getRestoreAdvancedOptions(options);
		assert.equal('newOptionValue', options[option1String]);

		// verify that selected backup sets get set correctly
		let selectedBackupSets = viewModel.selectedBackupSets;
		assert.equal(1, selectedBackupSets.length);
		assert.equal('file2', selectedBackupSets[0]);
	});


	test('on reset restore options should reset all options', () => {
		let restorePlanResponse: sqlops.RestorePlanResponse = {
			sessionId: '123',
			backupSetsToRestore: backupSets,
			canRestore: true,
			errorMessage: null,
			dbFiles: [],
			databaseNamesFromBackupSets: ['dbSource', 'dbSource2'],
			planDetails: planDetails
		};
		viewModel.filePath = 'filepath1';
		viewModel.onRestorePlanResponse(restorePlanResponse);

		//reset restore options
		viewModel.resetRestoreOptions('db2');

		// verify that file path, source database, target databasem and last backup get set correctly
		assert.equal('', viewModel.lastBackupTaken);
		assert.equal('db2', viewModel.sourceDatabaseName);
		assert.equal('db2', viewModel.targetDatabaseName);
		assert.equal('', viewModel.lastBackupTaken);
		assert.equal(0, viewModel.databaseList.length);

		// verify that advanced options get set correctly
		options = {};
		viewModel.getRestoreAdvancedOptions(options);
		assert.equal(undefined, options[option1String]);

		// verify that selected backup sets get set correctly
		let selectedBackupSets = viewModel.selectedBackupSets;
		assert.equal(undefined, selectedBackupSets);
	});

	test('update options with config info should update option correctly', () => {
		let databaseList = ['db1', 'db2'];
		let configInfo: { [key: string]: any } = {};
		configInfo['sourceDatabaseNamesWithBackupSets'] = databaseList;
		configInfo[option1String] = 'option1 from config info';
		viewModel.updateOptionWithConfigInfo(configInfo);
		assert.equal(3, viewModel.databaseList.length);
		assert.equal('', viewModel.databaseList[0]);
		assert.equal(databaseList[1], viewModel.databaseList[1]);
		assert.equal(databaseList[2], viewModel.databaseList[2]);
		assert.equal('option1 from config info', viewModel.getOptionValue(option1String));

		// verify that the options from get restore advanced options doesn't contain option1String
		options = {};
		viewModel.getRestoreAdvancedOptions(options);
		assert.equal(undefined, options[option1String]);
	});

	test('on restore from changed should set readHeaderFromMedia and reset the source database names and selected database name correctly', () => {
		viewModel.databaseList = ['', 'db1', 'db2'];
		viewModel.sourceDatabaseName = 'sourceDatabase';
		viewModel.filePath = 'filepath';
		viewModel.readHeaderFromMedia = false;
		viewModel.onRestoreFromChanged(true);
		assert.equal(true, viewModel.readHeaderFromMedia);
		assert.equal(undefined, viewModel.sourceDatabaseName);
		assert.equal('', viewModel.filePath);

		viewModel.sourceDatabaseName = 'sourceDatabase2';
		viewModel.onRestoreFromChanged(false);
		assert.equal(false, viewModel.readHeaderFromMedia);
		assert.equal('', viewModel.sourceDatabaseName);
	});
});
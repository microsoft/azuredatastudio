/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import * as types from 'vs/base/common/types';

import { Event, Emitter } from 'vs/base/common/event';
import { ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';

export interface RestoreOptionsElement {
	optionMetadata: sqlops.ServiceOption;
	defaultValue: any;
	currentValue: any;
}

/**
 * Parameters for setting the widget in the restore dialog
 */
export interface RestoreOptionParam {
	optionName: string;
	value: any;
	isReadOnly: boolean;
}

/**
 * Parameters for setting the list of source database names and selected database name in the restore dialog
 */
export interface SouceDatabaseNamesParam {
	databaseNames: string[];
	selectedDatabase: string;
}

/**
 * View model for restore dialog
 */
export class RestoreViewModel {
	public filePath: string;
	public sourceDatabaseName: string;
	public targetDatabaseName: string;
	public lastBackupTaken: string;
	public databaseList: string[];
	public readHeaderFromMedia: boolean;
	public selectedBackupSets: string[];
	public defaultBackupFolder: string;

	private _onSetLastBackupTaken = new Emitter<string>();
	public onSetLastBackupTaken: Event<string> = this._onSetLastBackupTaken.event;

	private _onSetfilePath = new Emitter<string>();
	public onSetfilePath: Event<string> = this._onSetfilePath.event;

	private _onSetSourceDatabaseNames = new Emitter<SouceDatabaseNamesParam>();
	public onSetSourceDatabaseNames: Event<SouceDatabaseNamesParam> = this._onSetSourceDatabaseNames.event;

	private _onSetTargetDatabaseName = new Emitter<string>();
	public onSetTargetDatabaseName: Event<string> = this._onSetTargetDatabaseName.event;

	private _onSetRestoreOption = new Emitter<RestoreOptionParam>();
	public onSetRestoreOption: Event<RestoreOptionParam> = this._onSetRestoreOption.event;

	private _onUpdateBackupSetsToRestore = new Emitter<sqlops.DatabaseFileInfo[]>();
	public onUpdateBackupSetsToRestore: Event<sqlops.DatabaseFileInfo[]> = this._onUpdateBackupSetsToRestore.event;

	private _onUpdateRestoreDatabaseFiles = new Emitter<sqlops.RestoreDatabaseFileInfo[]>();
	public onUpdateRestoreDatabaseFiles: Event<sqlops.RestoreDatabaseFileInfo[]> = this._onUpdateRestoreDatabaseFiles.event;

	private _optionsMap: { [name: string]: RestoreOptionsElement } = {};

	constructor(optionsMetadata: sqlops.ServiceOption[]) {
		optionsMetadata.forEach(optionMetadata => {
			let defaultValue = this.getDisplayValue(optionMetadata, optionMetadata.defaultValue);
			this._optionsMap[optionMetadata.name] = {
				optionMetadata: optionMetadata,
				defaultValue: defaultValue,
				currentValue: defaultValue
			};
		});
	}

	/**
	* Get option display value
	*/
	public getDisplayValue(optionMetadata: sqlops.ServiceOption, optionValue: any): any {
		let displayValue: any;
		switch (optionMetadata.valueType) {
			case ServiceOptionType.boolean:
				displayValue = DialogHelper.getBooleanValueFromStringOrBoolean(optionValue);
				break;
			case ServiceOptionType.category:
				let optionName = optionValue;
				if (!optionName && optionMetadata.categoryValues[0]) {
					optionName = optionMetadata.categoryValues[0].name;
				}
				displayValue = DialogHelper.getCategoryDisplayName(optionMetadata.categoryValues, optionName);
				break;
			case ServiceOptionType.string:
				displayValue = optionValue ? optionValue : '';
		}
		return displayValue;
	}

	/**
	* On restore from changed set readHeaderFromMedia and reset the source database names and selected database name based on isFromBackupFile value.
	*/
	public onRestoreFromChanged(isFromBackupFile: boolean) {
		this.readHeaderFromMedia = isFromBackupFile;
		if (isFromBackupFile) {
			this.updateFilePath('');
			this.updateSourceDatabaseNames([], undefined);
		} else {
			this.updateSourceDatabaseNames(this.databaseList, this.databaseList[0]);
		}
	}

	/**
	* Get option metadata from the option map
	*/
	public getOptionMetadata(optionName: string): sqlops.ServiceOption {
		return this._optionsMap[optionName] ? this._optionsMap[optionName].optionMetadata : undefined;
	}

	/**
	* Set current value for restore option
	*/
	public setOptionValue(optionName: string, value: any): void {
		if (this._optionsMap[optionName]) {
			this._optionsMap[optionName].currentValue = value;
		}
	}

	/**
	* Get current value for restore option
	*/
	public getOptionValue(optionName: string): any {
		if (this._optionsMap[optionName]) {
			return this._optionsMap[optionName].currentValue;
		}
		return undefined;
	}

	/**
	* Get restore advanced options. Only return the options that are different from the default options
	*/
	public getRestoreAdvancedOptions(options: { [name: string]: any }) {
		for (let key in this._optionsMap) {
			let optionElement = this._optionsMap[key];
			switch (optionElement.optionMetadata.valueType) {
				case ServiceOptionType.boolean:
					if (optionElement.currentValue !== optionElement.defaultValue) {
						options[key] = optionElement.currentValue;
					}
					break;
				case ServiceOptionType.category:
					if (optionElement.currentValue !== optionElement.defaultValue) {
						options[key] = DialogHelper.getCategoryName(optionElement.optionMetadata.categoryValues, optionElement.currentValue);
					}
					break;
				case ServiceOptionType.string:
					if (optionElement.currentValue && optionElement.currentValue !== optionElement.defaultValue) {
						options[key] = optionElement.currentValue;
					}
			}
		}
	}

	/**
	* On restore plan response will update all the information from restore plan response
	*/
	public onRestorePlanResponse(restorePlanResponse: sqlops.RestorePlanResponse): void {
		if (restorePlanResponse.planDetails && restorePlanResponse.planDetails['lastBackupTaken']) {
			this.updateLastBackupTaken(restorePlanResponse.planDetails['lastBackupTaken'].currentValue);
		}

		if (restorePlanResponse.planDetails && restorePlanResponse.planDetails['targetDatabaseName']) {
			this.updateTargetDatabaseName(restorePlanResponse.planDetails['targetDatabaseName'].currentValue);
		}
		this._onUpdateRestoreDatabaseFiles.fire(restorePlanResponse.dbFiles);
		this.updateSourceDatabaseNames(restorePlanResponse.databaseNamesFromBackupSets, restorePlanResponse.planDetails['sourceDatabaseName'].currentValue);
		this.updateOptionWithPlanDetail(restorePlanResponse.planDetails);
		this.updateBackupSetsToRestore(restorePlanResponse.backupSetsToRestore);
	}

	/**
	* Update options with plan details
	*/
	public updateOptionWithPlanDetail(planDetails: { [key: string]: sqlops.RestorePlanDetailInfo }): void {
		if (planDetails) {
			for (var key in planDetails) {
				let optionElement = this._optionsMap[key];
				if (optionElement) {
					let planDetailInfo = planDetails[key];
					optionElement.defaultValue = this.getDisplayValue(optionElement.optionMetadata, planDetailInfo.defaultValue);
					optionElement.currentValue = this.getDisplayValue(optionElement.optionMetadata, planDetailInfo.currentValue);
					this._onSetRestoreOption.fire({ optionName: key, value: this._optionsMap[key].currentValue, isReadOnly: planDetailInfo.isReadOnly });
				}
			}
		}
	}

	/**
	* Update options with restore config info. The option values will be both default and current values.
	*/
	public updateOptionWithConfigInfo(configInfo: { [key: string]: any }): void {
		if (configInfo) {
			if (configInfo['sourceDatabaseNamesWithBackupSets']) {
				let databaseList = configInfo['sourceDatabaseNamesWithBackupSets'];
				if (types.isStringArray(databaseList)) {
					this.databaseList = databaseList;
					this.databaseList.unshift('');
					this.readHeaderFromMedia = false;
					this.updateSourceDatabaseNames(this.databaseList, this.sourceDatabaseName);
				}
			}
			if (configInfo['defaultBackupFolder']) {
				this.defaultBackupFolder = configInfo['defaultBackupFolder'];
			}

			for (var key in configInfo) {
				let optionElement = this._optionsMap[key];
				if (optionElement) {
					let planDetailInfo = configInfo[key];
					optionElement.defaultValue = this.getDisplayValue(optionElement.optionMetadata, planDetailInfo);
					optionElement.currentValue = optionElement.defaultValue;
					this._onSetRestoreOption.fire({ optionName: key, value: this._optionsMap[key].currentValue, isReadOnly: true });
				}
			}
		}
	}

	/**
	* Update backup sets to restore
	*/
	public updateBackupSetsToRestore(backupSetsToRestore: sqlops.DatabaseFileInfo[]): void {
		this.selectedBackupSets = null;
		if (backupSetsToRestore) {
			this.selectedBackupSets = [];
			backupSetsToRestore.forEach(backupFile => {
				if (backupFile.isSelected) {
					this.selectedBackupSets.push(backupFile.id);
				}
			});
			this._onUpdateBackupSetsToRestore.fire(backupSetsToRestore);
		}
	}

	/**
	* Reset restore options to the default value
	*/
	public resetRestoreOptions(databaseName: string): void {
		this.sourceDatabaseName = databaseName ? databaseName : '';
		this.updateTargetDatabaseName(databaseName);
		this.updateSourceDatabaseNames([], this.sourceDatabaseName);
		this.updateFilePath('');
		this.updateLastBackupTaken('');
		this.databaseList = [];
		this.selectedBackupSets = null;
		for (var key in this._optionsMap) {
			this._optionsMap[key].defaultValue = this.getDisplayValue(this._optionsMap[key].optionMetadata, this._optionsMap[key].optionMetadata.defaultValue);
			this._optionsMap[key].currentValue = this._optionsMap[key].defaultValue;
			this._onSetRestoreOption.fire({ optionName: key, value: this._optionsMap[key].defaultValue, isReadOnly: false });
		}
	}

	/**
	* Update last backup taken
	*/
	public updateLastBackupTaken(value: string) {
		this.lastBackupTaken = value;
		this._onSetLastBackupTaken.fire(value);
	}

	/**
	* Update file path
	*/
	public updateFilePath(value: string) {
		this.filePath = value;
		this._onSetfilePath.fire(value);
	}

	/**
	* Update source database names and selected database
	*/
	public updateSourceDatabaseNames(options: string[], selectedDatabase: string) {
		this.sourceDatabaseName = selectedDatabase;
		this._onSetSourceDatabaseNames.fire({ databaseNames: options, selectedDatabase: selectedDatabase });
	}

	/**
	* Update target database name
	*/
	public updateTargetDatabaseName(value: string) {
		this.targetDatabaseName = value;
		this._onSetTargetDatabaseName.fire(value);
	}
}
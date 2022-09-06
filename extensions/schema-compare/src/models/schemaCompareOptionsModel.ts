/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as loc from '../localizedConstants';
import * as mssql from 'mssql';
import * as vscode from 'vscode';

export class SchemaCompareOptionsModel {
	// key is the option display name and values are checkboxValue and optionName
	private optionsValueNameLookup: { [key: string]: mssql.IOptionWithValue } = {};
	private includeObjectTypesLookup: { [key: string]: mssql.IOptionWithValue } = {};

	constructor(public deploymentOptions: mssql.DeploymentOptions) {
		this.setOptionsToValueNameLookup();
		this.setIncludeObjectTypesLookup();
	}

	/*
	 * Sets deployment option's checkbox values and property name to the optionsValueNameLookup map
	 */
	public setOptionsToValueNameLookup(): void {
		Object.entries(this.deploymentOptions.booleanOptionsDictionary).forEach(option => {
			const optionValue: mssql.IOptionWithValue = {
				optionName: option[0],
				checked: option[1].value
			};
			this.optionsValueNameLookup[option[1].displayName] = optionValue;
		});
	}

	/*
	 * Initialize options data from deployment options for table component
	 * Returns data as [booleanValue, optionName]
	 */
	public getOptionsData(): any[][] {
		let data: any[][] = [];
		Object.entries(this.deploymentOptions.booleanOptionsDictionary).forEach(option => {
			// option[1] holds checkedbox value and displayName
			data.push([option[1].value, option[1].displayName]);
		});

		return data.sort((a, b) => a[1].localeCompare(b[1]));
	}

	/*
	* Sets the selected option checkbox value to the deployment options
	*/
	public setDeploymentOptions(): void {
		Object.entries(this.optionsValueNameLookup).forEach(option => {
			// option[1] holds checkedbox value and optionName
			this.deploymentOptions.booleanOptionsDictionary[option[1].optionName].value = option[1].checked;
		});
	}

	/*
	* Sets the checkbox value to the optionsValueNameLookup map
	*/
	public setOptionValue(displayName: string, checked: boolean): void {
		this.optionsValueNameLookup[displayName].checked = checked;
	}

	/*
	* Gets the description of the selected option by getting the option name from the optionsValueNameLookup
	*/
	public getOptionDescription(displayName: string): string {
		const optionName = this.optionsValueNameLookup[displayName];
		if (optionName === undefined) {
			void vscode.window.showWarningMessage(loc.OptionNotFoundWarningMessage(displayName));
		}
		return optionName !== undefined ? this.deploymentOptions.booleanOptionsDictionary[optionName.optionName].description : '';
	}

	/*
	 * Sets include object types option's checkbox values and property name to the includeObjectTypesLookup map
	 */
	public setIncludeObjectTypesLookup(): void {
		Object.entries(this.deploymentOptions.objectTypesDictionary).forEach(option => {
			const optionValue: mssql.IOptionWithValue = {
				optionName: option[0],
				checked: this.getIncludeObjectTypeOptionCheckStatus(option[0])
			};
			this.includeObjectTypesLookup[option[1]] = optionValue;
		});
	}

	/*
	 * Initialize options data from include objects options for table component
	 * Returns data as [booleanValue, optionName]
	 */
	public getIncludeObjectTypesOptionsData(): any[][] {
		let data: any[][] = [];
		Object.entries(this.deploymentOptions.objectTypesDictionary).forEach(option => {
			// option[1] is the display name and option[0] is the optionName
			data.push([this.getIncludeObjectTypeOptionCheckStatus(option[0]), option[1]]);
		});

		return data.sort((a, b) => a[1].localeCompare(b[1]));
	}

	/*
	* Gets the selected/default value of the object type option
	* return false for the deploymentOptions.excludeObjectTypes option, if it is in ObjectTypesDictionary
	*/
	public getIncludeObjectTypeOptionCheckStatus(optionName: string): boolean {
		return (this.deploymentOptions.excludeObjectTypes.value?.find(x => x.toLowerCase() === optionName.toLowerCase())) !== undefined ? false : true;
	}


	/*
	* Sets the checkbox value to the includeObjectTypesLookup map
	*/
	public setIncludeObjectTypesOptionValue(displayName: string, checked: boolean): void {
		this.includeObjectTypesLookup[displayName].checked = checked;
	}

	/*
	* Sets the selected option checkbox value to the deployment options
	*/
	public setIncludeObjectTypesToDeploymentOptions(): void {
		let finalExcludedObjectTypes: string[] = [];
		Object.entries(this.includeObjectTypesLookup).forEach(option => {
			// option[1] holds checkedbox value and optionName
			// sending the unchecked(false) options only to the excludeObjectTypes
			if (!option[1].checked) {
				finalExcludedObjectTypes.push(option[1].optionName);
			}
		});

		this.deploymentOptions.excludeObjectTypes.value = finalExcludedObjectTypes;
	}
}

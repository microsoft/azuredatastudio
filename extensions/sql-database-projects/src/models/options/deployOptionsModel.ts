/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';

export class DeployOptionsModel {
	// key is the option display name and values are checkboxValue and optionName
	private optionsValueNameLookup: { [key: string]: mssql.IOptionWithValue } = {};

	constructor(public deploymentOptions: mssql.DeploymentOptions) {
		this.setOptionsToValueNameLookup();
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
			void vscode.window.showWarningMessage(constants.OptionNotFoundWarningMessage(displayName));
		}
		return optionName !== undefined ? this.deploymentOptions.booleanOptionsDictionary[optionName.optionName].description : '';
	}
}

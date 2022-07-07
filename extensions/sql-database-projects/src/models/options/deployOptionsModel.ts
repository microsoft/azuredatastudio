/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';

export class DeployOptionsModel {
	private optionsValueNameLookup: { [key: string]: mssql.IOptionWithValue } = {};

	constructor(public deploymentOptions: mssql.DeploymentOptions) {
	}

	/**
	 * Initialize options data from deployment options for table component
	 * Also preparing optionsValueNameLookup Map holding onchange checkbox values and property name
	 * Returns data as [booleanValue, optionName]
	 */
	public initializeOptionsData(): any[][] {
		let data: any[][] = [];
		Object.entries(this.deploymentOptions.booleanOptionsDictionary).forEach(option => {
			const optionDisplayName = option[1].displayName;
			const checkedValue = option[1].value;
			const optionValue: mssql.IOptionWithValue = {
				optionName: option[0],
				checked: checkedValue
			};
			// push to table data array
			data.push([checkedValue, optionDisplayName]);
			// push to optionsValueNameLookup
			this.optionsValueNameLookup[optionDisplayName] = optionValue;
		});

		return data.sort((a, b) => a[1].localeCompare(b[1]));
	}

	/*
	* Sets the selected option checkbox value to the deployment options
	* option[0] - option label
	* option[1] - checkedbox value
	*/
	public setDeploymentOptions(): void {
		Object.entries(this.optionsValueNameLookup).forEach(option => {
			this.deploymentOptions.booleanOptionsDictionary[option[1].optionName].value = option[1].checked;
		});
	}

	/*
	* Sets the checkbox value to the optionsValueNameLookup map
	*/
	public setOptionValue(label: string, checked: boolean): void {
		this.optionsValueNameLookup[label].checked = checked;
	}

	/*
	* Gets the description of the selected option by getting the option name from the optionsValueNameLookup
	*/
	public getOptionDescription(label: string): string {
		const optionName = this.optionsValueNameLookup[label];
		if (optionName === undefined) {
			void vscode.window.showWarningMessage(constants.optionNotFoundWarningMessage(label));
		}
		return optionName !== undefined ? this.deploymentOptions.booleanOptionsDictionary[optionName.optionName].description : '';
	}
}

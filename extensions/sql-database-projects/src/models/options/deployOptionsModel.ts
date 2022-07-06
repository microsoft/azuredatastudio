/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';

export class DeployOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;
	public optionsValueNameLookup: { [key: string]: mssql.IOptionWithValue } = {};


	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = { ...defaultOptions };
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
	* Gets the description of the selected option by getting the option name from the optionsValueNameLookup
	*/
	public getOptionDescription(label: string): string {
		const optionName = this.optionsValueNameLookup[label].optionName;
		return this.deploymentOptions.booleanOptionsDictionary[optionName]?.description;
	}
}

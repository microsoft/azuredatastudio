/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';

export class DeployOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;
	public optionsNameAndPropMap: { [key: string]: string } = {};
	public optionsValueLookup: { [key: string]: boolean } = {};

	constructor(private defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = { ...this.defaultOptions };
	}

	/**
	 * Initialize options data from deployment options for table component
	 * Also preparing optionsValueLookup Map holding onchange checkbox values and optionsNameAndPropMap to hold property name for the option
	 * Returns data as [booleanValue, optionName]
	 */
	public initializeOptionsData(): any[][] {
		let data: any[][] = [];
		Object.entries(this.deploymentOptions.booleanOptionsDictionary).forEach(option => {
			const optionDisplayName = option[1].displayName;
			const propertyName = option[0];
			const checkedValue = option[1].value;
			// push to table array
			data.push([checkedValue, optionDisplayName]);
			// push to optionsNameAndPropMap
			this.optionsNameAndPropMap[optionDisplayName] = propertyName;
			// push to optionsValueLookup
			this.optionsValueLookup[optionDisplayName] = checkedValue;
		});

		return data.sort((a, b) => a[1].localeCompare(b[1]));
	}

	/*
	* Sets the selected option checkbox value to the deployment options
	* option[0] - option label
	* option[1] - checkedbox value
	*/
	public setDeploymentOptions(): void {
		Object.entries(this.optionsValueLookup).forEach(option => {
			this.deploymentOptions.booleanOptionsDictionary[this.getPropertyNameByLabel(option[0])].value = option[1];
		});
	}

	/*
	* Gets the selected/default value of the option
	*/
	public getOptionValue(label: string): boolean {
		return this.deploymentOptions.booleanOptionsDictionary[this.getPropertyNameByLabel(label)]?.value;
	}

	/*
	* Gets the description of the selected option
	*/
	public getOptionDescription(label: string): string {
		return this.deploymentOptions.booleanOptionsDictionary[this.getPropertyNameByLabel(label)]?.description;
	}

	/*
	* Gets the property name by option display name
	*/
	public getPropertyNameByLabel(label: string): string {
		return this.optionsNameAndPropMap[label];
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';

export class DeployOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;

	public optionsLookup: Map<string, boolean> = new Map<string, boolean>();
	public optionsMapTable: { [key: string]: mssql.DacDeployOptionPropertyBoolean } = {};
	public optionsLabels: string[] = [];

	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = defaultOptions;
		this.UpdateOptionsMapTable();
		this.optionsLabels = Object.keys(this.deploymentOptions.optionsMapTable).sort();
	}

	public UpdateOptionsMapTable() {
		this.optionsMapTable = this.deploymentOptions.optionsMapTable;
	}

	/**
	 * Gets the options checkbox values by iterating through the labels and gets the default/changed value from the optionsMapTable
	 * Returns data as [optionName, booleanValue], where these values are sending to the options table component
	 */
	public getOptionsData(): string[][] {
		let data: any = [];
		this.optionsLookup = new Map<string, boolean>();
		this.optionsLabels.forEach(l => {
			let checked: boolean | undefined = this.getDeployOptionUtil(l);
			if (checked !== undefined) {
				data.push([checked, l]);
				this.optionsLookup?.set(l, checked);
			}
		});
		return data;
	}

	/*
	* Sets the selected option checkbox value to the optionsMapTable
	*/
	public setDeploymentOptions(): void {
		for (let option of this.optionsLookup) {
			let val = this.optionsMapTable[option[0]];
			if (val !== undefined && val?.value !== option[1]) {
				val.value = option[1];
				this.optionsMapTable[option[0]] = val;
			}
		}

		// Set the deployment optionsMapTable with the updated optionsMapTable
		this.deploymentOptions.optionsMapTable = this.optionsMapTable;
	}

	/*
	* Gets the selected/default value of the option
	*/
	public getDeployOptionUtil(label: string): boolean | undefined {
		return this.optionsMapTable[label]?.value;
	}

	/*
	* Gets the description of the option selected
	*/
	public getDescription(label: string): string | undefined {
		return this.optionsMapTable[label]?.description;
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';

export class DeployOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;

	public optionsLookup: Map<string, boolean> = new Map<string, boolean>();
	public includeObjectsLookup: Map<string, boolean> = new Map<string, boolean>();
	public optionsMapTable: { [key: string]: mssql.DacDeployOptionPropertyBoolean } = {};
	public optionsLabels: string[] = [];
	public includeObjectTypeLabels: string[] = [];
	public excludedObjectTypes: number[] = [];

	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = defaultOptions;
		this.InitializeOptionsMapTable();
		this.optionsLabels = this.convertLabelstoPascalCase(Object.keys(this.deploymentOptions.optionsMapTable).sort());
		this.includeObjectTypeLabels = this.convertLabelstoPascalCase(Object.keys(this.deploymentOptions.includeObjects).sort());
	}

	/*
	* Converts labels to PascalCase to match with default option name
	*/
	public convertLabelstoPascalCase(optionsLabels: string[]): string[] {
		return optionsLabels.map(label => { return label.charAt(0).toUpperCase() + label.slice(1); });
	}

	/*
	* Converts label text to camelCase to match with default option name
	*/
	public convertLabeltoCamelCase(label: string): string {
		return label.charAt(0).toLowerCase() + label.slice(1);
	}

	public InitializeOptionsMapTable() {
		this.optionsMapTable = this.deploymentOptions.optionsMapTable;
	}

	/**
	 * Initialize options data from optionsMaptable for options table component, and Prepares optionsLookup Map for holding the onchange checkbox values
	 * Returns data as [optionName, booleanValue]
	 */
	public InitializeOptionsData(): string[][] {
		let data: any = [];
		this.optionsLookup = new Map<string, boolean>();
		this.optionsLabels.forEach(optionLabel => {
			const label = this.convertLabeltoCamelCase(optionLabel);
			let checked: boolean | undefined = this.getOptionValue(label);
			if (checked !== undefined) {
				data.push([checked, optionLabel]);
				this.optionsLookup?.set(label, checked);
			}
		});
		return data;
	}

	/*
	* Sets the selected option checkbox value to the optionsMapTable
	* option[0] - option label
	* option[1] - checkedbox value
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
	public getOptionValue(label: string): boolean | undefined {
		return this.optionsMapTable[label]?.value;
	}

	/*
	* Gets the description of the selected option
	*/
	public getOptionDescription(label: string): string | undefined {
		return this.optionsMapTable[label.charAt(0).toLowerCase() + label.slice(1)]?.description;
	}


	/**
	 * Initialize options data from includeObjects for options table component, and Prepares optionsLookup Map for holding the onchange checkbox values
	 * Returns data as [optionName, booleanValue]
	 */
	public InitializeObjectsData(): string[][] {
		let data: any = [];
		this.includeObjectsLookup = new Map<string, boolean>();
		this.includeObjectTypeLabels.forEach(optionLabel => {
			const label = this.convertLabeltoCamelCase(optionLabel);
			let checked: boolean | undefined = this.getIncludedObjectsCheckedboxValue(label);
			if (checked !== undefined) {
				data.push([checked, optionLabel]);
				this.includeObjectsLookup?.set(label, checked);
			}
		});
		return data;
	}

	/*
	* Gets the selected/default value of the object type option
	*/
	public getIncludedObjectsCheckedboxValue(label: string): boolean | undefined {
		return (this.deploymentOptions.excludeObjectTypes.value?.find(x => x === this.deploymentOptions.includeObjects[label])) !== undefined ? false : true;
	}

	/*
	* Sets the selected option checkbox value to the exclude object types
	* option[0] - option label
	* option[1] - checkedbox value
	*/
	public setIncludeObjectTypeOptions(): void {
		for (let option of this.includeObjectsLookup) {
			let optionNum = this.deploymentOptions.includeObjects[option[0]];
			if (optionNum !== undefined && !option[1]) {
				this.excludedObjectTypes.push(optionNum);
			}
		}

		this.deploymentOptions.excludeObjectTypes.value = this.excludedObjectTypes;
	}
}

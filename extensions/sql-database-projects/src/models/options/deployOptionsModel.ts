/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';

export class DeployOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;
	public optionsMapTable: { [key: string]: mssql.DacDeployOptionPropertyBoolean } = {};
	public optionsLabels: string[] = [];
	public optionsNameAndPropMap: { [key: string]: string } = {};
	public optionsValueLookup: { [key: string]: boolean } = {};
	public includeObjectsLookup: Map<string, boolean> = new Map<string, boolean>();
	public includeObjectTypeLabels: string[] = [];
	public excludedObjectTypes: number[] = [];

	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = defaultOptions;
		this.InitializeOptionsMapTable();
		this.optionsLabels = this.prepareOptionsNamesPropsMapAndGetSortedLabels();
		this.includeObjectTypeLabels = Object.keys(this.deploymentOptions.includeObjects).sort();
	}

	/*
	* This method prepares
	* a. Sorted array of option display names for indexing
	* b. Map table to hold displayNames and corresponding propertyName, this will help to get the right key of selected option index
	*/
	public prepareOptionsNamesPropsMapAndGetSortedLabels(): string[] {
		let optionsLabels: string[] = [];
		Object.entries(this.deploymentOptions.optionsMapTable).forEach(option => {
			const optionDisplayName = option[1].displayName;
			const propertyName = option[0];
			// push to optionsLabels Array
			optionsLabels.push(optionDisplayName);
			// push to optionsNameAndPropMap
			this.optionsNameAndPropMap[optionDisplayName] = propertyName;
		});
		return optionsLabels.sort();
	}

	public InitializeOptionsMapTable() {
		this.optionsMapTable = this.deploymentOptions.optionsMapTable;
	}

	/**
	 * Initialize options data from optionsMaptable for table component
	 * also preparing optionsValueLookup Map holding onchange checkbox values
	 * Returns data as [booleanValue, optionName]
	 */
	public InitializeOptionsData(): string[][] {
		let data: any = [];
		this.optionsLabels.forEach(optionLabel => {
			const checked = this.getOptionValue(optionLabel);
			data.push([checked, optionLabel]);
			this.optionsValueLookup[optionLabel] = checked;
		});
		return data;
	}

	/*
	* Sets the selected option checkbox value to the optionsMapTable
	* option[0] - option label
	* option[1] - checkedbox value
	*/
	public setDeploymentOptions(): void {
		Object.entries(this.optionsValueLookup).forEach(option => {
			const propertyName = this.optionsNameAndPropMap[option[0]];
			this.optionsMapTable[propertyName].value = option[1];
		});

		// Set the deployment optionsMapTable with the updated optionsMapTable
		this.deploymentOptions.optionsMapTable = this.optionsMapTable;
	}

	/*
	* Gets the selected/default value of the option
	*/
	public getOptionValue(label: string): boolean {
		const propertyName = this.optionsNameAndPropMap[label];
		return this.optionsMapTable[propertyName]?.value;
	}

	/*
	* Gets the description of the selected option
	*/
	public getOptionDescription(label: string): string {
		const propertyName = this.optionsNameAndPropMap[label];
		return this.optionsMapTable[propertyName]?.description;
	}


	/**
	 * Initialize options data from includeObjects for options table component
	 * also prepares optionsLookup Map holding the onchange checkbox values
	 * Returns data as [booleanValue, optionName]
	 */
	public InitializeObjectsData(): string[][] {
		let data: any = [];
		this.includeObjectsLookup = new Map<string, boolean>();
		this.includeObjectTypeLabels.forEach(optionLabel => {
			let checked: boolean | undefined = this.getIncludedObjectsCheckedboxValue(optionLabel);
			if (checked !== undefined) {
				data.push([checked, optionLabel]);
				this.includeObjectsLookup?.set(optionLabel, checked);
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

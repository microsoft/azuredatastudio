/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as mssql from 'mssql';

export class SchemaCompareOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;
	public booleanOptionsMap: { [key: string]: mssql.DacDeployOptionPropertyBoolean } = {};
	public optionsLabels: string[] = [];
	public optionsNameAndPropMap: { [key: string]: string } = {};
	public optionsValueLookup: { [key: string]: boolean } = {};
	public excludedObjectTypes: number[] = [];
	public includeObjectTypeLabels: string[] = [];
	public includeObjectsLookup: Map<string, boolean> = new Map<string, boolean>();

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
		Object.entries(this.deploymentOptions.booleanOptionsDict).forEach(option => {
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
		this.booleanOptionsMap = this.deploymentOptions.booleanOptionsDict;
	}

	/*
	* Initialize options data from optionsMaptable for table component
	* also preparing optionsValueLookup Map holding onchange checkbox values
	* Returns data as [booleanValue, optionName]
	*/
	public InitializeOptionsData(): string[][] {
		let data = [];
		this.optionsLabels.forEach(optionLabel => {
			const checked = this.getOptionValue(optionLabel);
			data.push([checked, optionLabel]);
			this.optionsValueLookup[optionLabel] = checked;
		});
		return data;
	}

	public InitializeObjectsData(): string[][] {
		let data: any = [];
		this.includeObjectsLookup = new Map<string, boolean>();
		this.includeObjectTypeLabels.forEach(optionLabel => {
			const label = optionLabel;
			let checked: boolean | undefined = this.getSchemaCompareIncludedObjectsUtil(label);
			if (checked !== undefined) {
				data.push([checked, optionLabel]);
				this.includeObjectsLookup?.set(label, checked);
			}
		});
		return data;
	}

	public setDeploymentOptions() {
		Object.entries(this.optionsValueLookup).forEach(option => {
			const propertyName = this.optionsNameAndPropMap[option[0]];
			this.booleanOptionsMap[propertyName].value = option[1];
		});

		// Set the deployment booleanOptionsDict with the updated booleanOptionsMap
		this.deploymentOptions.booleanOptionsDict = this.booleanOptionsMap;
	}

	/*
	* Gets the selected/default value of the option
	*/
	public getOptionValue(label: string): boolean {
		const propertyName = this.optionsNameAndPropMap[label];
		return this.booleanOptionsMap[propertyName]?.value;
	}

	/*
	* Gets the description of the selected option
	*/
	public getOptionDescription(label: string): string {
		const propertyName = this.optionsNameAndPropMap[label];
		return this.booleanOptionsMap[propertyName]?.description;
	}

	public getSchemaCompareIncludedObjectsUtil(label: string): boolean {
		return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === this.deploymentOptions.includeObjects[label])) !== undefined ? false : true;
	}

	public setSchemaCompareIncludedObjectsUtil() {
		for (let option of this.includeObjectsLookup) {
			let optionNum = this.deploymentOptions.includeObjects[option[0]];
			if (optionNum !== undefined && !option[1]) {
				this.excludedObjectTypes.push(optionNum);
			}
		}

		this.deploymentOptions.excludeObjectTypes.value = this.excludedObjectTypes;
	}
}

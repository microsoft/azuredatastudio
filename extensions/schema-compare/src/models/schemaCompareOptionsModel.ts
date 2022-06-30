/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as mssql from 'mssql';

export class SchemaCompareOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;
	public excludedObjectTypes: number[] = [];
	public optionsMapTable: { [key: string]: mssql.DacDeployOptionPropertyBoolean } = {};
	public optionsLabels: string[] = [];
	public includeObjectTypeLabels: string[] = [];

	public optionsLookup: Map<string, boolean> = new Map<string, boolean>();
	public includeObjectsLookup: Map<string, boolean> = new Map<string, boolean>();

	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = defaultOptions;
		this.UpdateOptionsMapTable();
		this.optionsLabels = this.convertLabelstoPascalCase(Object.keys(this.deploymentOptions.optionsMapTable).sort());
		this.includeObjectTypeLabels = this.convertLabelstoPascalCase(Object.keys(this.deploymentOptions.includeObjects).sort());
	}

	public UpdateOptionsMapTable() {
		this.optionsMapTable = this.deploymentOptions.optionsMapTable;
	}

	public InitializeOptionsData(): string[][] {
		let data = [];
		this.optionsLookup = new Map<string, boolean>();
		this.optionsLabels.forEach(optionLabel => {
			const label = this.convertLabeltoCamelCase(optionLabel);
			let checked: boolean = this.getSchemaCompareOptionUtil(label);
			data.push([checked, optionLabel]);
			this.optionsLookup.set(label, checked);
		});
		return data;
	}

	public InitializeObjectsData(): string[][] {
		let data: any = [];
		this.includeObjectsLookup = new Map<string, boolean>();
		this.includeObjectTypeLabels.forEach(optionLabel => {
			const label = this.convertLabeltoCamelCase(optionLabel);
			let checked: boolean | undefined = this.getSchemaCompareIncludedObjectsUtil(label);
			if (checked !== undefined) {
				data.push([checked, optionLabel]);
				this.includeObjectsLookup?.set(label, checked);
			}
		});
		return data;
	}

	public setDeploymentOptions() {
		for (let option of this.optionsLookup) {
			let optionProp = this.optionsMapTable[option[0]];
			if (optionProp.value !== option[1]) {
				optionProp.value = option[1];
				this.optionsMapTable[option[0]] = optionProp;
			}
		}
	}

	public setSchemaCompareOptionUtil(label: string, value: boolean) {
		let optionProp = this.optionsMapTable[label];
		optionProp.value = value;
		return this.optionsMapTable[label] = optionProp;
	}

	public getSchemaCompareOptionUtil(label): boolean {
		return this.optionsMapTable[label].value;
	}

	public getDescription(label: string): string {
		return this.optionsMapTable[label]?.description;
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
}

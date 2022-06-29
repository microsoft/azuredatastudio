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
		this.optionsLabels = Object.keys(this.deploymentOptions.optionsMapTable).sort();
		this.includeObjectTypeLabels = Object.keys(this.deploymentOptions.includeObjects).sort();
	}

	public UpdateOptionsMapTable() {
		this.optionsMapTable = this.deploymentOptions.optionsMapTable;
	}

	public getOptionsData(): string[][] {
		let data = [];
		this.optionsLookup = new Map<string, boolean>();
		this.optionsLabels.forEach(l => {
			let checked: boolean = this.getSchemaCompareOptionUtil(l);
			data.push([checked, l]);
			this.optionsLookup.set(l, checked);
		});
		return data;
	}

	public getObjectsData(): string[][] {
		let data: any = [];
		this.includeObjectsLookup = new Map<string, boolean>();
		this.includeObjectTypeLabels.forEach(l => {
			let checked: boolean | undefined = this.getSchemaCompareIncludedObjectsUtil(l);
			if (checked !== undefined) {
				data.push([checked, l]);
				this.includeObjectsLookup?.set(l, checked);
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
}

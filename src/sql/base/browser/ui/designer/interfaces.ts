/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface DesignerComponentInput {
	/**
	 * Gets the object type display name.
	 */

	readonly objectTypeDisplayName: string;
	/**
	 * Gets the designer view specification.
	 */
	getView(): Promise<DesignerView>;

	/**
	 * Gets the data.
	 */
	getData(): Promise<DesignerData>;

	/**
	 * Process the edit made in the designer.
	 * @param edit the information about the edit.
	 */
	processEdit(edit: DesignerEdit): Promise<DesignerEditResult>;
}

export const NameProperty = 'name';
export const ScriptProperty = 'script';

export interface DesignerView {
	components?: DesignerDataPropertyInfo[]
	tabs: DesignerTab[];
}


export interface DesignerTab {
	title: string;
	components: DesignerDataPropertyInfo[];
}

export interface DesignerData {
	[key: string]: InputBoxProperties | CheckBoxProperties | DropDownProperties | DesignerTableProperties;
}

export interface DesignerDataPropertyInfo {
	propertyName: string;
	componentType: DesignerComponentTypeName;
	group?: string;
	componentProperties?: InputBoxProperties | CheckBoxProperties | DropDownProperties | DesignerTableProperties;
}

export type DesignerComponentTypeName = 'input' | 'checkbox' | 'dropdown' | 'table';

export interface ComponentProperties {
	title?: string;

	ariaLabel?: string;

	width?: number | string;

	enabled?: boolean;
}

export interface CategoryValue {
	displayName: string;
	name: string;
}

export interface DropDownProperties extends ComponentProperties {
	value?: string | CategoryValue;
	values?: string[] | CategoryValue[];
}

export interface CheckBoxProperties extends ComponentProperties {
	checked?: boolean;
}

export interface InputBoxProperties extends ComponentProperties {
	value?: string;
	inputType?: 'text' | 'number';
}

export interface DesignerTableProperties extends ComponentProperties {
	/**
	 * the name of the properties to be displayed, properties not in this list will be accessible in details view.
	 */
	columns?: string[];

	/**
	 * The display name of the object type
	 */
	objectTypeDisplayName: string;

	/**
	 * the properties of the table data item
	 */
	itemProperties?: DesignerDataPropertyInfo[];

	data?: DesignerTableComponentRowData[];
}

export interface DesignerTableComponentRowData {
	[key: string]: InputBoxProperties | CheckBoxProperties | DropDownProperties | DesignerTableProperties;
}


export enum DesignerEditType {
	Add = 0,
	Remove = 1,
	Update = 2
}

export interface DesignerEdit {
	type: DesignerEditType;
	property: DesignerEditIdentifier;
	value: any;
}

export type DesignerEditIdentifier = string | { parentProperty: string, index: number, property: string };

export interface DesignerEditResult {
	isValid: boolean;
	errors?: { message: string, property?: DesignerEditIdentifier }[];
}

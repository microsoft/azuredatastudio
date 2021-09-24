/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface DesignerComponentInput {
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

export interface DesignerData {
	[key: string]: InputComponentData | CheckboxComponentData | DropdownComponentData | TableComponentData;
}

export interface ComponentData {
	enabled?: boolean;
}

export interface InputComponentData extends ComponentData {
	value: string;
}

export interface CheckboxComponentData extends ComponentData {
	checked: boolean;
}

export interface DropdownComponentData extends ComponentData {
	value: string;
	optionalValues: string[];
}

export interface TableComponentData extends ComponentData {
	rows: TableComponentRowData[];
}

export interface TableComponentRowData {
	[key: string]: InputComponentData | CheckboxComponentData | DropdownComponentData | TableComponentData;
}


export interface DesignerView {
	components?: DesignerComponentType[]
	tabs: DesignerTab[];
}

export enum DesignerEditTypes {
	Add = 0,
	Remove = 1,
	Update = 2
}

export interface DesignerEdit {
	type: DesignerEditTypes;
	property: string;
	value: any;
}

export interface DesignerEditResult {
	isValid: boolean;
	errorMessages?: string[];
}

export interface DesignerTab {
	title: string;
	labelOnTop?: boolean;
	components: DesignerComponentType[];
}

export type DesignerComponentType = InputComponentInfo | CheckboxComponentInfo | DropdownComponentInfo | TableComponentInfo;

export type DesignerComponentTypeName = 'input' | 'checkbox' | 'dropdown' | 'table';

export interface UIComponentInfo {
	/**
	 * The name of the property that the component is bound to.
	 */
	property: string;

	type: DesignerComponentTypeName;

	title?: string;

	ariaLabel?: string;

	width?: number;

	description?: string;
}

export interface InputComponentInfo extends UIComponentInfo {
	placeholder?: string;
	inputType?: 'text' | 'number';
}

export interface DropdownComponentInfo extends UIComponentInfo {
	options: string[]
}

export interface CheckboxComponentInfo extends UIComponentInfo {
}

export interface TableComponentInfo extends UIComponentInfo {
	/**
	 * the name of the properties to be displayed, properties not in this list will be accessible in details view.
	 */
	columns: string[];

	/**
	 * the properties of the table data item
	 */
	itemProperties: DesignerComponentType[];
}

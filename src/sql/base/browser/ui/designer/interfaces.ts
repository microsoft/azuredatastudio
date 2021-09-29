/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface DesignerComponentInput {
	/**
	 * Gets the object type display name.
	 */

	readonly objectType: string;
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

export interface DesignerData {
	[key: string]: InputComponentData | CheckboxComponentData | DropdownComponentData | TableComponentData;
}

export interface ComponentData {
	enabled?: boolean;
}

export interface InputComponentData extends ComponentData {
	value: string | number;
}

export interface CheckboxComponentData extends ComponentData {
	value: boolean;
}

export interface DropdownComponentData extends ComponentData {
	value: string;
	options: string[];
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
	errorMessages?: string[];
}

export interface DesignerTab {
	title: string;
	labelOnTop?: boolean;
	components: DesignerComponentType[];
}

export type DesignerComponentType = InputComponentDefinition | CheckboxComponentDefinition | DropdownComponentDefinition | TableComponentDefinition;

export type DesignerComponentTypeName = 'input' | 'checkbox' | 'dropdown' | 'table';

export interface ComponentDefinition {
	/**
	 * The name of the property that the component is bound to.
	 */
	property: string;

	type: DesignerComponentTypeName;

	title?: string;

	ariaLabel?: string;

	width?: number;

	description?: string;

	group?: string;
}

export interface InputComponentDefinition extends ComponentDefinition {
	placeholder?: string;
	inputType?: 'text' | 'number';
}

export interface DropdownComponentDefinition extends ComponentDefinition {
	options: string[]
}
export interface CheckboxComponentDefinition extends ComponentDefinition {
}

export interface TableComponentDefinition extends ComponentDefinition {
	/**
	 * the name of the properties to be displayed, properties not in this list will be accessible in details view.
	 */
	columns: string[];

	/**
	 * the properties of the table data item
	 */
	itemProperties: DesignerComponentType[];

	/**
	 * The display name of the object type
	 */
	objectType: string;
}

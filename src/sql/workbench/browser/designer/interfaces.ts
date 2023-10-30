/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PanelTabIdentifier } from 'sql/base/browser/ui/panel/panel';
import { Dimension } from 'vs/base/browser/dom';
import { Event } from 'vs/base/common/event';

export interface DesignerComponentInput {
	/**
	 * The event that is triggerd when the designer state changes.
	 */
	readonly onStateChange: Event<DesignerStateChangedEventArgs>;

	/**
	 * The event that is triggerd when the designer information is loaded.
	 */
	readonly onInitialized: Event<void>;

	/**
	 * The event that is triggerd when an edit is processed.
	 */
	readonly onEditProcessed: Event<DesignerEditProcessedEventArgs>;

	/**
	 * The event that is triggerd when a refresh of the UI is requested.
	 */
	readonly onRefreshRequested: Event<void>;

	/**
	 * The event that is triggerd when force submit of the pending edit is requested.
	 */
	readonly onSubmitPendingEditRequested: Event<void>;

	/**
	 * Gets the object type display name.
	 */
	readonly objectTypeDisplayName: string;

	/**
	 * Gets the designer view specification.
	 */
	readonly view: DesignerView;

	/**
	 * Gets the view model.
	 */
	readonly viewModel: DesignerViewModel;

	/**
	 * Gets the issues.
	 */
	readonly issues: DesignerIssue[] | undefined;

	/**
	 * Start initilizing the designer input object.
	 */
	initialize(): Promise<void>;

	/**
	 * Start processing the edit made in the designer, the OnEditProcessed event will be fired when the processing is done.
	 * @param edit the information about the edit.
	 */
	processEdit(edit: DesignerEdit): void;

	/**
	 * A boolean value indicating whether the current state is valid.
	 */
	readonly valid: boolean;

	/**
	 * A boolean value indicating whether the current state is dirty.
	 */
	readonly dirty: boolean;

	/**
	 * Current in progress action.
	 */
	readonly pendingAction?: DesignerAction;

	/**
	 * The UI state of the designer, used to restore the state.
	 */
	designerUIState?: DesignerUIState;
}

export interface DesignerUIState {
	activeContentTabId: PanelTabIdentifier;
	activeScriptTabId: PanelTabIdentifier;
}

export type DesignerAction = 'publish' | 'initialize' | 'processEdit' | 'generateScript' | 'generateReport';

export interface DesignerEditProcessedEventArgs {
	result: DesignerEditResult;
	edit: DesignerEdit
}

export interface DesignerStateChangedEventArgs {
	currentState: DesignerState,
	previousState: DesignerState
}
export interface DesignerState {
	valid: boolean;
	dirty: boolean;
	pendingAction?: DesignerAction
}

export const NameProperty = 'name';
export const ScriptProperty = 'script';
export const CanBeDeletedProperty = 'canBeDeleted';

export interface DesignerView {
	components?: DesignerDataPropertyInfo[]
	tabs: DesignerTab[];
}


export interface DesignerTab {
	title: string;
	components: DesignerDataPropertyInfo[];
}

export interface DesignerViewModel {
	[key: string]: InputBoxProperties | CheckBoxProperties | DropDownProperties | DesignerTableProperties;
}

export interface DesignerDataPropertyInfo {
	propertyName: string;
	description?: string;
	componentType: DesignerComponentTypeName;
	showInPropertiesView?: boolean;
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
	isEditable?: boolean;
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
	 * The display name of the object type.
	 */
	objectTypeDisplayName: string;
	/**
	 * The properties of the table data item.
	 */
	itemProperties?: DesignerDataPropertyInfo[];
	/**
	 * The data to be displayed.
	 */
	data?: DesignerTableComponentRowData[];
	/**
	 * Whether user can add new rows to the table. The default value is true.
	 */
	canAddRows?: boolean;
	/**
	 * Whether user can remove rows from the table. The default value is true.
	 */
	canRemoveRows?: boolean;
	/**
	 * Whether user can move rows from one index to another. The default value is false.
	 */
	canMoveRows?: boolean;
	/**
	 * Whether user can insert rows at a given index to the table. The default value is false.
	 */
	canInsertRows?: boolean;
	/**
	 * Whether to show confirmation when user removes a row. The default value is false.
	 */
	showRemoveRowConfirmation?: boolean;
	/**
	 * The confirmation message to be displayed when user removes a row.
	 */
	removeRowConfirmationMessage?: string;
	/**
	 * Whether to show the item detail in properties view. The default value is true.
	 */
	showItemDetailInPropertiesView?: boolean;
	/**
	 * The label of the add new button. The default value is 'Add New'.
	 */
	labelForAddNewButton?: string;
}

export interface DesignerTableComponentRowData {
	[key: string]: InputBoxProperties | CheckBoxProperties | DropDownProperties | DesignerTableProperties | boolean;
	canBeDeleted?: boolean;
}


export enum DesignerEditType {
	Add = 0,
	Remove = 1,
	Update = 2,
	Move = 3
}

export interface DesignerEdit {
	type: DesignerEditType;
	path: DesignerPropertyPath;
	value?: any;
	source: DesignerUIArea;
}

export type DesignerUIArea = 'PropertiesView' | 'ScriptView' | 'TopContentView' | 'TabsView';

export type DesignerPropertyPath = (string | number)[];
export const DesignerRootObjectPath: DesignerPropertyPath = [];

export type DesignerIssueSeverity = 'error' | 'warning' | 'information';
export type DesignerIssue = {
	description: string,
	propertyPath?: DesignerPropertyPath,
	severity: DesignerIssueSeverity,
	moreInfoLink?: string;
};

export interface DesignerEditResult {
	isValid: boolean;
	refreshView?: boolean;
	issues?: DesignerIssue[];
}

export interface DesignerTextEditor {
	/**
	 * Gets or sets the content of the text editor
	 */
	content: string;
	/**
	 * Event fired when the content is changed by user
	 */
	readonly onDidContentChange: Event<string>;

	/**
	 * Update the size of the editor
	 */
	layout(dimensions: Dimension): void;
}

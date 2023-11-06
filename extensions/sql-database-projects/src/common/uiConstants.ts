/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// CSS Styles
export namespace cssStyles {
	export const text = { 'user-select': 'text', 'cursor': 'text' };
	export const tableHeader = { ...text, 'text-align': 'left', 'border': 'none', 'font-size': '12px', 'font-weight': 'normal', 'color': '#666666' };
	export const tableRow = { ...text, 'border-top': 'solid 1px #ccc', 'border-bottom': 'solid 1px #ccc', 'border-left': 'none', 'border-right': 'none', 'font-size': '12px' };
	export const fontWeightBold = { 'font-weight': 'bold' };
	export const titleFontSize = 13;

	export const optionsTableHeader = { 'display': 'none', 'border': 'none !important' };
	export const optionsTableRowLabel = { ...text, 'border-left': 'none', 'border-right': 'none', 'border-top': 'none', 'border-bottom': 'none' }
	export const optionsTableRowCheckbox = { 'border-left': 'none', 'border-right': 'none', 'border-top': 'none', 'border-bottom': 'none' }

	export const publishDialogLabelWidth = '205px';
	export const publishDialogTextboxWidth = '190px';
	export const publishDialogDropdownWidth = '192px';
	export const PublishingOptionsButtonWidth = '100px';

	export const addDatabaseReferenceDialogLabelWidth = '215px';
	export const addDatabaseReferenceInputboxWidth = '220px';

	export const createProjectFromDatabaseLabelWidth = '110px';
	export const createProjectFromDatabaseTextboxWidth = '300px';

	export const updateProjectFromDatabaseLabelWidth = '110px';
	export const updateProjectFromDatabaseTextboxWidth = '300px';

	// font-styles
	export namespace fontStyle {
		export const normal = 'normal';
		export const italics = 'italic';
	}
}

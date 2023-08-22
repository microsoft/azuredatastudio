/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// CSS Styles
export namespace cssStyles {
	export const text = { 'user-select': 'text', 'cursor': 'text' };
	export const tableHeader = { ...text, 'text-align': 'left', 'border': 'none', 'font-size': '12px', 'font-weight': 'normal', 'color': '#666666' };
	export const tableRow = { ...text, 'border-top': 'solid 1px #ccc', 'border-bottom': 'solid 1px #ccc', 'border-left': 'none', 'border-right': 'none', 'font-size': '12px' };
	export const fontWeightBold = { 'font-weight': 'bold' };
	export const titleFontSize = 13;

	export const configureDialogLabelWidth = '30px';
	export const configureDialogTextboxWidth = '190px';
	export const configureDialogTextboxWidthSmall = '100px';
	export const configureDialogDropdownWidth = '150px';
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export namespace cssStyles {
	export const tableBorderCss = '1px solid #ccc';
	export const titleCss = { 'font-size': '20px', 'font-weight': '600', 'margin-block-end': '0px', 'margin-block-start': '0px' };
	export const tableHeaderCss = { 'font-weight': 'bold', 'text-transform': 'uppercase', 'font-size': '10px', 'user-select': 'text' };
	export const permissionsTableHeaderCss = { ...tableHeaderCss, 'text-align': 'center' };
	export const permissionCheckboxCss = { 'margin-top': '5px', 'margin-left': '13px' };
	// The Named users/groups section potentially has a scrollbar so we shift all the other parts over so the columns still align correctly
	export const scrollbarMarginGapCss = { 'margin-right': '17px' };
	export const tableHeaderLayoutCss = { 'padding-left': '10px', 'box-sizing': 'border-box', 'user-select': 'text', ...cssStyles.scrollbarMarginGapCss };
}

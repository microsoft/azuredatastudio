/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ICheckboxStyles } from 'sql/base/browser/ui/checkbox/checkbox';
import { IDropdownStyles } from 'sql/base/browser/ui/dropdownList/dropdownList';
import { IEditableDropdownStyles } from 'sql/base/browser/ui/editableDropdown/browser/dropdown';
import { IListBoxStyles } from 'sql/base/browser/ui/listBox/listBox';
import { ISelectBoxStyles } from 'sql/base/browser/ui/selectBox/selectBox';
import { ITableFilterStyles } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import *  as sqlcr from 'sql/platform/theme/common/colorRegistry';
import { disabledCheckboxForeground } from 'sql/platform/theme/common/colors';
import { IInfoBoxStyles } from 'sql/workbench/browser/ui/infoBox/infoBox';
import { IButtonStyles } from 'vs/base/browser/ui/button/button';
import { IStyleOverride, defaultButtonStyles, defaultCountBadgeStyles, defaultInputBoxStyles, defaultListStyles, defaultSelectBoxStyles as vsDefaultSelectBoxStyles, overrideStyles } from 'vs/platform/theme/browser/defaultStyles';
import * as cr from 'vs/platform/theme/common/colorRegistry';


export const defaultCheckboxStyles: ICheckboxStyles = {
	disabledCheckboxForeground: cr.asCssVariable(disabledCheckboxForeground)
};

export function getCheckboxStyles(override: IStyleOverride<ICheckboxStyles>): ICheckboxStyles {
	return overrideStyles(override, defaultCheckboxStyles);
}

export const defaultInfoButtonStyles: IButtonStyles = {
	buttonBackground: cr.asCssVariable(sqlcr.infoButtonBackground),
	buttonForeground: cr.asCssVariable(sqlcr.infoButtonForeground),
	buttonBorder: cr.asCssVariable(sqlcr.infoButtonBorder),
	buttonHoverBackground: cr.asCssVariable(sqlcr.infoButtonHoverBackground),
	buttonSeparator: undefined,
	buttonSecondaryBackground: undefined,
	buttonSecondaryForeground: undefined,
	buttonSecondaryHoverBackground: undefined,
	buttonSecondaryBorder: undefined,
	buttonDisabledBackground: undefined,
	buttonDisabledForeground: undefined,
	buttonDisabledBorder: undefined
}

export const defaultEditableDropdownStyles: IEditableDropdownStyles = {
	contextBackground: cr.asCssVariable(cr.editorBackground),
	contextBorder: cr.asCssVariable(cr.inputBorder),
	...defaultInputBoxStyles,
	...defaultListStyles
}

export const defaultTableFilterStyles: ITableFilterStyles = {
	...defaultInputBoxStyles,
	...defaultButtonStyles,
	...defaultCountBadgeStyles,
	...defaultListStyles
}

export const defaultDropdownStyles: IDropdownStyles = {
	foregroundColor: cr.asCssVariable(cr.inputForeground),
	borderColor: cr.asCssVariable(cr.inputBorder),
	backgroundColor: cr.asCssVariable(cr.editorBackground)
}

export const defaultListBoxStyles: IListBoxStyles = {
	inputValidationInfoBorder: cr.asCssVariable(cr.inputValidationInfoBorder),
	inputValidationInfoBackground: cr.asCssVariable(cr.inputValidationInfoBackground),
	inputValidationWarningBorder: cr.asCssVariable(cr.inputValidationWarningBorder),
	inputValidationWarningBackground: cr.asCssVariable(cr.inputValidationWarningBackground),
	inputValidationErrorBorder: cr.asCssVariable(cr.inputValidationErrorBorder),
	inputValidationErrorBackground: cr.asCssVariable(cr.inputValidationErrorBackground),
	...vsDefaultSelectBoxStyles
}

export const defaultSelectBoxStyles: ISelectBoxStyles = {
	inputValidationInfoBorder: cr.asCssVariable(cr.inputValidationInfoBorder),
	inputValidationInfoBackground: cr.asCssVariable(cr.inputValidationInfoBackground),
	inputValidationWarningBorder: cr.asCssVariable(cr.inputValidationWarningBorder),
	inputValidationWarningBackground: cr.asCssVariable(cr.inputValidationWarningBackground),
	inputValidationErrorBorder: cr.asCssVariable(cr.inputValidationErrorBorder),
	inputValidationErrorBackground: cr.asCssVariable(cr.inputValidationErrorBackground),
	...vsDefaultSelectBoxStyles
}

export const defaultInfoBoxStyles: IInfoBoxStyles = {
	informationBackground: cr.asCssVariable(sqlcr.infoBoxInformationBackground),
	warningBackground: cr.asCssVariable(sqlcr.infoBoxWarningBackground),
	errorBackground: cr.asCssVariable(sqlcr.infoBoxErrorBackground),
	successBackground: cr.asCssVariable(sqlcr.infoBoxSuccessBackground)
};

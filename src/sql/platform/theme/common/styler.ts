/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as colors from './colors';

import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as cr from 'vs/platform/theme/common/colorRegistry';
import * as sqlcr from 'sql/platform/theme/common/colorRegistry';
import { attachStyler, computeStyles, defaultButtonStyles, defaultListStyles, IColorMapping, IStyleOverrides } from 'vs/platform/theme/common/styler';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IThemable } from 'vs/base/common/styler';

export interface IDropdownStyleOverrides extends IStyleOverrides {
	foregroundColor?: cr.ColorIdentifier;
	borderColor?: cr.ColorIdentifier;
	backgroundColor?: cr.ColorIdentifier;
	buttonForeground?: cr.ColorIdentifier;
	buttonBackground?: cr.ColorIdentifier;
	buttonHoverBackground?: cr.ColorIdentifier;
	buttonBorder?: cr.ColorIdentifier;
	buttonFocusOutline?: cr.ColorIdentifier;
}

export const defaultDropdownStyle: IDropdownStyleOverrides = {
	foregroundColor: cr.inputForeground,
	borderColor: cr.inputBorder,
	backgroundColor: cr.editorBackground,
	buttonForeground: cr.buttonForeground,
	buttonBackground: cr.buttonBackground,
	buttonHoverBackground: cr.buttonHoverBackground,
	buttonBorder: cr.contrastBorder,
	buttonFocusOutline: colors.buttonFocusOutline
};

export function attachDropdownStyler(widget: IThemable, themeService: IThemeService, style?: IDropdownStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultDropdownStyle, ...(style || {}) }, widget);
}

export interface IInputBoxStyleOverrides extends IStyleOverrides {
	inputBackground?: cr.ColorIdentifier,
	inputForeground?: cr.ColorIdentifier,
	disabledInputBackground?: cr.ColorIdentifier,
	disabledInputForeground?: cr.ColorIdentifier,
	inputBorder?: cr.ColorIdentifier,
	inputValidationInfoBorder?: cr.ColorIdentifier,
	inputValidationInfoBackground?: cr.ColorIdentifier,
	inputValidationWarningBorder?: cr.ColorIdentifier,
	inputValidationWarningBackground?: cr.ColorIdentifier,
	inputValidationErrorBorder?: cr.ColorIdentifier,
	inputValidationErrorBackground?: cr.ColorIdentifier
}

export const defaultInputBoxStyles: IInputBoxStyleOverrides = {
	inputBackground: cr.inputBackground,
	inputForeground: cr.inputForeground,
	disabledInputBackground: colors.disabledInputBackground,
	disabledInputForeground: colors.disabledInputForeground,
	inputBorder: cr.inputBorder,
	inputValidationInfoBorder: cr.inputValidationInfoBorder,
	inputValidationInfoBackground: cr.inputValidationInfoBackground,
	inputValidationWarningBorder: cr.inputValidationWarningBorder,
	inputValidationWarningBackground: cr.inputValidationWarningBackground,
	inputValidationErrorBorder: cr.inputValidationErrorBorder,
	inputValidationErrorBackground: cr.inputValidationErrorBackground
};

export function attachInputBoxStyler(widget: IThemable, themeService: IThemeService, style?: IInputBoxStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultInputBoxStyles, ...(style || {}) }, widget);
}

export interface ISelectBoxStyleOverrides extends IStyleOverrides {
	selectBackground?: cr.ColorIdentifier,
	selectListBackground?: cr.ColorIdentifier,
	selectForeground?: cr.ColorIdentifier,
	selectBorder?: cr.ColorIdentifier,
	disabledSelectBackground?: cr.ColorIdentifier,
	disabledSelectForeground?: cr.ColorIdentifier,
	inputValidationInfoBorder?: cr.ColorIdentifier,
	inputValidationInfoBackground?: cr.ColorIdentifier,
	inputValidationWarningBorder?: cr.ColorIdentifier,
	inputValidationWarningBackground?: cr.ColorIdentifier,
	inputValidationErrorBorder?: cr.ColorIdentifier,
	inputValidationErrorBackground?: cr.ColorIdentifier,
	focusBorder?: cr.ColorIdentifier,
	listFocusBackground?: cr.ColorIdentifier,
	listFocusForeground?: cr.ColorIdentifier,
	listFocusOutline?: cr.ColorIdentifier,
	listHoverBackground?: cr.ColorIdentifier,
	listHoverForeground?: cr.ColorIdentifier
}

export const defaultSelectBoxStyles: ISelectBoxStyleOverrides = {
	selectBackground: cr.selectBackground,
	selectListBackground: cr.selectListBackground,
	selectForeground: cr.selectForeground,
	selectBorder: cr.selectBorder,
	disabledSelectBackground: colors.disabledInputBackground,
	disabledSelectForeground: colors.disabledInputForeground,
	inputValidationInfoBorder: cr.inputValidationInfoBorder,
	inputValidationInfoBackground: cr.inputValidationInfoBackground,
	inputValidationWarningBorder: cr.inputValidationWarningBorder,
	inputValidationWarningBackground: cr.inputValidationWarningBackground,
	inputValidationErrorBorder: cr.inputValidationErrorBorder,
	inputValidationErrorBackground: cr.inputValidationErrorBackground,
	focusBorder: cr.focusBorder,
	listFocusBackground: cr.listFocusBackground,
	listFocusForeground: cr.listFocusForeground,
	listFocusOutline: cr.activeContrastBorder,
	listHoverBackground: cr.listHoverBackground,
	listHoverForeground: cr.listHoverForeground,
	listHoverOutline: cr.activeContrastBorder
};

export function attachSelectBoxStyler(widget: IThemable, themeService: IThemeService, style?: ISelectBoxStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultSelectBoxStyles, ...(style || {}) }, widget);
}

export function attachListBoxStyler(widget: IThemable, themeService: IThemeService, style?:
	{
		selectBackground?: cr.ColorIdentifier,
		selectForeground?: cr.ColorIdentifier,
		selectBorder?: cr.ColorIdentifier,
		inputValidationInfoBorder?: cr.ColorIdentifier,
		inputValidationInfoBackground?: cr.ColorIdentifier,
		inputValidationWarningBorder?: cr.ColorIdentifier,
		inputValidationWarningBackground?: cr.ColorIdentifier,
		inputValidationErrorBorder?: cr.ColorIdentifier,
		inputValidationErrorBackground?: cr.ColorIdentifier
	}): IDisposable {
	return attachStyler(themeService, {
		selectBackground: (style && style.selectBackground) || cr.selectBackground,
		selectForeground: (style && style.selectForeground) || cr.selectForeground,
		selectBorder: (style && style.selectBorder) || cr.selectBorder,
		inputValidationInfoBorder: (style && style.inputValidationInfoBorder) || cr.inputValidationInfoBorder,
		inputValidationInfoBackground: (style && style.inputValidationInfoBackground) || cr.inputValidationInfoBackground,
		inputValidationWarningBorder: (style && style.inputValidationWarningBorder) || cr.inputValidationWarningBorder,
		inputValidationWarningBackground: (style && style.inputValidationWarningBackground) || cr.inputValidationWarningBackground,
		inputValidationErrorBorder: (style && style.inputValidationErrorBorder) || cr.inputValidationErrorBorder,
		inputValidationErrorBackground: (style && style.inputValidationErrorBackground) || cr.inputValidationErrorBackground
	}, widget);
}

export interface ITableStyleOverrides extends IStyleOverrides {
	listFocusBackground?: cr.ColorIdentifier,
	listFocusForeground?: cr.ColorIdentifier,
	listActiveSelectionBackground?: cr.ColorIdentifier,
	listActiveSelectionForeground?: cr.ColorIdentifier,
	listFocusAndSelectionBackground?: cr.ColorIdentifier,
	listFocusAndSelectionForeground?: cr.ColorIdentifier,
	listInactiveFocusBackground?: cr.ColorIdentifier,
	listInactiveSelectionBackground?: cr.ColorIdentifier,
	listInactiveSelectionForeground?: cr.ColorIdentifier,
	listHoverBackground?: cr.ColorIdentifier,
	listHoverForeground?: cr.ColorIdentifier,
	listDropBackground?: cr.ColorIdentifier,
	listFocusOutline?: cr.ColorIdentifier,
	listInactiveFocusOutline?: cr.ColorIdentifier,
	listSelectionOutline?: cr.ColorIdentifier,
	listHoverOutline?: cr.ColorIdentifier,
	tableHeaderBackground?: cr.ColorIdentifier,
	tableHeaderForeground?: cr.ColorIdentifier,
}

export const defaultTableStyles: ITableStyleOverrides = {
	listFocusBackground: cr.listFocusBackground,
	listFocusForeground: cr.listFocusForeground,
	listActiveSelectionBackground: cr.listActiveSelectionBackground,
	listActiveSelectionForeground: cr.listActiveSelectionForeground,
	listFocusAndSelectionBackground: colors.listFocusAndSelectionBackground,
	listFocusAndSelectionForeground: cr.listActiveSelectionForeground,
	listInactiveFocusBackground: cr.listInactiveFocusBackground,
	listInactiveSelectionBackground: cr.listInactiveSelectionBackground,
	listInactiveSelectionForeground: cr.listInactiveSelectionForeground,
	listHoverBackground: cr.listHoverBackground,
	listHoverForeground: cr.listHoverForeground,
	listDropBackground: cr.listDropBackground,
	listFocusOutline: cr.activeContrastBorder,
	listSelectionOutline: cr.activeContrastBorder,
	listHoverOutline: cr.activeContrastBorder,
	listInactiveFocusOutline: cr.listInactiveFocusOutline,
	tableHeaderBackground: colors.tableHeaderBackground,
	tableHeaderForeground: colors.tableHeaderForeground
};

export function attachTableStyler(widget: IThemable, themeService: IThemeService, style?: ITableStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultTableStyles, ...(style || {}) }, widget);
}

export interface IHighPerfTableStyleOverrides extends IStyleOverrides {
	listFocusBackground?: cr.ColorIdentifier,
	listFocusForeground?: cr.ColorIdentifier,
	listActiveSelectionBackground?: cr.ColorIdentifier,
	listActiveSelectionForeground?: cr.ColorIdentifier,
	listFocusAndSelectionBackground?: cr.ColorIdentifier,
	listFocusAndSelectionForeground?: cr.ColorIdentifier,
	listInactiveFocusBackground?: cr.ColorIdentifier,
	listInactiveSelectionBackground?: cr.ColorIdentifier,
	listInactiveSelectionForeground?: cr.ColorIdentifier,
	listHoverBackground?: cr.ColorIdentifier,
	listHoverForeground?: cr.ColorIdentifier,
	listDropBackground?: cr.ColorIdentifier,
	listFocusOutline?: cr.ColorIdentifier,
	listInactiveFocusOutline?: cr.ColorIdentifier,
	listSelectionOutline?: cr.ColorIdentifier,
	listHoverOutline?: cr.ColorIdentifier,
	tableHeaderBackground?: cr.ColorIdentifier,
	tableHeaderForeground?: cr.ColorIdentifier,
	cellOutlineColor?: cr.ColorIdentifier,
	tableHeaderAndRowCountColor?: cr.ColorIdentifier
}

export const defaultHighPerfTableStyles: IColorMapping = {
	listFocusBackground: cr.listFocusBackground,
	listFocusForeground: cr.listFocusForeground,
	listActiveSelectionBackground: cr.listActiveSelectionBackground,
	listActiveSelectionForeground: cr.listActiveSelectionForeground,
	listFocusAndSelectionBackground: colors.listFocusAndSelectionBackground,
	listFocusAndSelectionForeground: cr.listActiveSelectionForeground,
	listInactiveFocusBackground: cr.listInactiveFocusBackground,
	listInactiveSelectionBackground: cr.listInactiveSelectionBackground,
	listInactiveSelectionForeground: cr.listInactiveSelectionForeground,
	listHoverBackground: cr.listHoverBackground,
	listHoverForeground: cr.listHoverForeground,
	listDropBackground: cr.listDropBackground,
	listFocusOutline: cr.activeContrastBorder,
	listSelectionOutline: cr.activeContrastBorder,
	listHoverOutline: cr.activeContrastBorder,
	tableHeaderBackground: colors.tableHeaderBackground,
	tableHeaderForeground: colors.tableHeaderForeground,
	cellOutlineColor: colors.tableCellOutline,
	tableHeaderAndRowCountColor: colors.tableCellOutline
};

export function attachHighPerfTableStyler(widget: IThemable, themeService: IThemeService, overrides?: IHighPerfTableStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultHighPerfTableStyles, ...(overrides || {}) }, widget);
}

export interface IEditableDropdownStyleOverrides extends IStyleOverrides {
	listFocusBackground?: cr.ColorIdentifier,
	listFocusForeground?: cr.ColorIdentifier,
	listActiveSelectionBackground?: cr.ColorIdentifier,
	listActiveSelectionForeground?: cr.ColorIdentifier,
	listFocusAndSelectionBackground?: cr.ColorIdentifier,
	listFocusAndSelectionForeground?: cr.ColorIdentifier,
	listInactiveFocusBackground?: cr.ColorIdentifier,
	listInactiveSelectionBackground?: cr.ColorIdentifier,
	listInactiveSelectionForeground?: cr.ColorIdentifier,
	listHoverBackground?: cr.ColorIdentifier,
	listHoverForeground?: cr.ColorIdentifier,
	listDropBackground?: cr.ColorIdentifier,
	listFocusOutline?: cr.ColorIdentifier,
	listInactiveFocusOutline?: cr.ColorIdentifier,
	listSelectionOutline?: cr.ColorIdentifier,
	listHoverOutline?: cr.ColorIdentifier,
	inputBackground?: cr.ColorIdentifier,
	inputForeground?: cr.ColorIdentifier,
	inputBorder?: cr.ColorIdentifier,
	inputValidationInfoBorder?: cr.ColorIdentifier,
	inputValidationInfoBackground?: cr.ColorIdentifier,
	inputValidationWarningBorder?: cr.ColorIdentifier,
	inputValidationWarningBackground?: cr.ColorIdentifier,
	inputValidationErrorBorder?: cr.ColorIdentifier,
	inputValidationErrorBackground?: cr.ColorIdentifier,
	contextBackground?: cr.ColorIdentifier,
	contextBorder?: cr.ColorIdentifier
}

export const defaultEditableDropdownStyle: IEditableDropdownStyleOverrides = {
	listFocusBackground: cr.listFocusBackground,
	listFocusForeground: cr.listFocusForeground,
	listActiveSelectionBackground: cr.listActiveSelectionBackground,
	listActiveSelectionForeground: cr.listActiveSelectionForeground,
	listFocusAndSelectionBackground: cr.listActiveSelectionBackground,
	listFocusAndSelectionForeground: cr.listActiveSelectionForeground,
	listInactiveFocusBackground: cr.listInactiveFocusBackground,
	listInactiveSelectionBackground: cr.listInactiveSelectionBackground,
	listInactiveSelectionForeground: cr.listInactiveSelectionForeground,
	listHoverBackground: cr.listHoverBackground,
	listHoverForeground: cr.listHoverForeground,
	listDropBackground: cr.listDropBackground,
	listFocusOutline: cr.activeContrastBorder,
	listSelectionOutline: cr.activeContrastBorder,
	listHoverOutline: cr.activeContrastBorder,
	listInactiveFocusOutline: cr.listInactiveFocusOutline,
	inputBackground: cr.inputBackground,
	inputForeground: cr.inputForeground,
	inputBorder: cr.inputBorder,
	inputValidationInfoBorder: cr.inputValidationInfoBorder,
	inputValidationInfoBackground: cr.inputValidationInfoBackground,
	inputValidationWarningBorder: cr.inputValidationWarningBorder,
	inputValidationWarningBackground: cr.inputValidationWarningBackground,
	inputValidationErrorBorder: cr.inputValidationErrorBorder,
	inputValidationErrorBackground: cr.inputValidationErrorBackground,
	contextBackground: cr.editorBackground,
	contextBorder: cr.inputBorder
};


export function attachEditableDropdownStyler(widget: IThemable, themeService: IThemeService, style?: IEditableDropdownStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultEditableDropdownStyle, ...(style || {}) }, widget);
}

export interface ICheckboxStyleOverrides extends IStyleOverrides {
	disabledCheckboxForeground?: cr.ColorIdentifier
}

export const defaultCheckboxStyles: ICheckboxStyleOverrides = {
	disabledCheckboxForeground: colors.disabledCheckboxForeground
};

export function attachCheckboxStyler(widget: IThemable, themeService: IThemeService, style?: ICheckboxStyleOverrides): IDisposable {
	return attachStyler(themeService, {}, widget);
}

export interface IInfoBoxStyleOverrides {
	informationBackground: cr.ColorIdentifier,
	warningBackground: cr.ColorIdentifier,
	errorBackground: cr.ColorIdentifier,
	successBackground: cr.ColorIdentifier
}

export const defaultInfoBoxStyles: IInfoBoxStyleOverrides = {
	informationBackground: sqlcr.infoBoxInformationBackground,
	warningBackground: sqlcr.infoBoxWarningBackground,
	errorBackground: sqlcr.infoBoxErrorBackground,
	successBackground: sqlcr.infoBoxSuccessBackground
};

export function attachInfoBoxStyler(widget: IThemable, themeService: IThemeService, style?: IInfoBoxStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultInfoBoxStyles, ...style }, widget);
}

export interface IInfoButtonStyleOverrides {
	buttonBackground: cr.ColorIdentifier,
	buttonForeground: cr.ColorIdentifier,
	buttonBorder: cr.ColorIdentifier,
	buttonHoverBackground: cr.ColorIdentifier
}

export const defaultInfoButtonStyles: IInfoButtonStyleOverrides = {
	buttonBackground: sqlcr.infoButtonBackground,
	buttonForeground: sqlcr.infoButtonForeground,
	buttonBorder: sqlcr.infoButtonBorder,
	buttonHoverBackground: sqlcr.infoButtonHoverBackground
};

export function attachInfoButtonStyler(widget: IThemable, themeService: IThemeService, style?: IInfoButtonStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultInfoButtonStyles, ...style }, widget);
}

export function attachTableFilterStyler(widget: IThemable, themeService: IThemeService): IDisposable {
	return attachStyler(themeService, {
		...defaultInputBoxStyles,
		buttonForeground: cr.buttonForeground,
		buttonBackground: cr.buttonBackground,
		buttonHoverBackground: cr.buttonHoverBackground,
		buttonSecondaryForeground: cr.buttonSecondaryForeground,
		buttonSecondaryBackground: cr.buttonSecondaryBackground,
		buttonSecondaryHoverBackground: cr.buttonSecondaryHoverBackground,
		buttonBorder: cr.buttonBorder,
		buttonSecondaryBorder: cr.buttonSecondaryBorder,
		buttonDisabledBorder: cr.buttonDisabledBorder,
		buttonDisabledBackground: cr.buttonDisabledBackground,
		buttonDisabledForeground: cr.buttonDisabledForeground,
		badgeBackground: cr.badgeBackground,
		badgeForeground: cr.badgeForeground,
		badgeBorder: cr.contrastBorder,
		...defaultListStyles,
	}, widget);
}

export function attachDesignerStyler(widget: any, themeService: IThemeService): IDisposable {
	function applyStyles(): void {
		const colorTheme = themeService.getColorTheme();
		const inputStyles = computeStyles(colorTheme, defaultInputBoxStyles);
		const selectBoxStyles = computeStyles(colorTheme, defaultSelectBoxStyles);
		const tableStyles = computeStyles(colorTheme, defaultTableStyles);
		const checkboxStyles = computeStyles(colorTheme, defaultCheckboxStyles);
		const buttonStyles = computeStyles(colorTheme, defaultButtonStyles);
		widget.style({
			inputBoxStyles: inputStyles,
			selectBoxStyles: selectBoxStyles,
			tableStyles: tableStyles,
			checkboxStyles: checkboxStyles,
			buttonStyles: buttonStyles
		});
	}

	applyStyles();

	return themeService.onDidColorThemeChange(applyStyles);
}

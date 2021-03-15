/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as colors from './colors';

import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as cr from 'vs/platform/theme/common/colorRegistry';
import * as sqlcr from 'sql/platform/theme/common/colorRegistry';
import { attachStyler, IColorMapping, IStyleOverrides } from 'vs/platform/theme/common/styler';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IThemable } from 'vs/base/common/styler';

export function attachDropdownStyler(widget: IThemable, themeService: IThemeService, style?:
	{
		backgroundColor?: cr.ColorIdentifier,
		foregroundColor?: cr.ColorIdentifier,
		borderColor?: cr.ColorIdentifier,
		buttonForeground?: cr.ColorIdentifier,
		buttonBackground?: cr.ColorIdentifier,
		buttonHoverBackground?: cr.ColorIdentifier,
		buttonFocusOutline?: cr.ColorIdentifier
	}): IDisposable {
	return attachStyler(themeService, {
		foregroundColor: (style && style.foregroundColor) || cr.inputForeground,
		borderColor: (style && style.borderColor) || cr.inputBorder,
		backgroundColor: (style && style.backgroundColor) || cr.editorBackground,
		buttonForeground: (style && style.buttonForeground) || cr.buttonForeground,
		buttonBackground: (style && style.buttonBackground) || cr.buttonBackground,
		buttonHoverBackground: (style && style.buttonHoverBackground) || cr.buttonHoverBackground,
		buttonBorder: cr.contrastBorder,
		buttonFocusOutline: (style && style.buttonFocusOutline) || colors.buttonFocusOutline
	}, widget);
}

export function attachInputBoxStyler(widget: IThemable, themeService: IThemeService, style?:
	{
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
	}): IDisposable {
	return attachStyler(themeService, {
		inputBackground: (style && style.inputBackground) || cr.inputBackground,
		inputForeground: (style && style.inputForeground) || cr.inputForeground,
		disabledInputBackground: (style && style.disabledInputBackground) || colors.disabledInputBackground,
		disabledInputForeground: (style && style.disabledInputForeground) || colors.disabledInputForeground,
		inputBorder: (style && style.inputBorder) || cr.inputBorder,
		inputValidationInfoBorder: (style && style.inputValidationInfoBorder) || cr.inputValidationInfoBorder,
		inputValidationInfoBackground: (style && style.inputValidationInfoBackground) || cr.inputValidationInfoBackground,
		inputValidationWarningBorder: (style && style.inputValidationWarningBorder) || cr.inputValidationWarningBorder,
		inputValidationWarningBackground: (style && style.inputValidationWarningBackground) || cr.inputValidationWarningBackground,
		inputValidationErrorBorder: (style && style.inputValidationErrorBorder) || cr.inputValidationErrorBorder,
		inputValidationErrorBackground: (style && style.inputValidationErrorBackground) || cr.inputValidationErrorBackground
	}, widget);
}

export function attachSelectBoxStyler(widget: IThemable, themeService: IThemeService, style?:
	{
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
	}): IDisposable {
	return attachStyler(themeService, {
		selectBackground: (style && style.selectBackground) || cr.selectBackground,
		selectListBackground: (style && style.selectListBackground) || cr.selectListBackground,
		selectForeground: (style && style.selectForeground) || cr.selectForeground,
		selectBorder: (style && style.selectBorder) || cr.selectBorder,
		disabledSelectBackground: (style && style.disabledSelectBackground) || colors.disabledInputBackground,
		disabledSelectForeground: (style && style.disabledSelectForeground) || colors.disabledInputForeground,
		inputValidationInfoBorder: (style && style.inputValidationInfoBorder) || cr.inputValidationInfoBorder,
		inputValidationInfoBackground: (style && style.inputValidationInfoBackground) || cr.inputValidationInfoBackground,
		inputValidationWarningBorder: (style && style.inputValidationWarningBorder) || cr.inputValidationWarningBorder,
		inputValidationWarningBackground: (style && style.inputValidationWarningBackground) || cr.inputValidationWarningBackground,
		inputValidationErrorBorder: (style && style.inputValidationErrorBorder) || cr.inputValidationErrorBorder,
		inputValidationErrorBackground: (style && style.inputValidationErrorBackground) || cr.inputValidationErrorBackground,
		focusBorder: (style && style.focusBorder) || cr.focusBorder,
		listFocusBackground: (style && style.listFocusBackground) || cr.listFocusBackground,
		listFocusForeground: (style && style.listFocusForeground) || cr.listFocusForeground,
		listFocusOutline: (style && style.listFocusOutline) || cr.activeContrastBorder,
		listHoverBackground: (style && style.listHoverBackground) || cr.listHoverBackground,
		listHoverForeground: (style && style.listHoverForeground) || cr.listHoverForeground,
		listHoverOutline: (style && style.listFocusOutline) || cr.activeContrastBorder
	}, widget);
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

export function attachTableStyler(widget: IThemable, themeService: IThemeService, style?: {
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
	tableHeaderForeground?: cr.ColorIdentifier
}): IDisposable {
	return attachStyler(themeService, {
		listFocusBackground: (style && style.listFocusBackground) || cr.listFocusBackground,
		listFocusForeground: (style && style.listFocusForeground) || cr.listFocusForeground,
		listActiveSelectionBackground: (style && style.listActiveSelectionBackground) || cr.listActiveSelectionBackground,
		listActiveSelectionForeground: (style && style.listActiveSelectionForeground) || cr.listActiveSelectionForeground,
		listFocusAndSelectionBackground: style && style.listFocusAndSelectionBackground || colors.listFocusAndSelectionBackground,
		listFocusAndSelectionForeground: (style && style.listFocusAndSelectionForeground) || cr.listActiveSelectionForeground,
		listInactiveFocusBackground: (style && style.listInactiveFocusBackground),
		listInactiveSelectionBackground: (style && style.listInactiveSelectionBackground) || cr.listInactiveSelectionBackground,
		listInactiveSelectionForeground: (style && style.listInactiveSelectionForeground) || cr.listInactiveSelectionForeground,
		listHoverBackground: (style && style.listHoverBackground) || cr.listHoverBackground,
		listHoverForeground: (style && style.listHoverForeground) || cr.listHoverForeground,
		listDropBackground: (style && style.listDropBackground) || cr.listDropBackground,
		listFocusOutline: (style && style.listFocusOutline) || cr.activeContrastBorder,
		listSelectionOutline: (style && style.listSelectionOutline) || cr.activeContrastBorder,
		listHoverOutline: (style && style.listHoverOutline) || cr.activeContrastBorder,
		listInactiveFocusOutline: style && style.listInactiveFocusOutline,
		tableHeaderBackground: (style && style.tableHeaderBackground) || colors.tableHeaderBackground,
		tableHeaderForeground: (style && style.tableHeaderForeground) || colors.tableHeaderForeground
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
	cellOutlineColor?: cr.ColorIdentifier,
	tableHeaderAndRowCountColor?: cr.ColorIdentifier
}

export function attachHighPerfTableStyler(widget: IThemable, themeService: IThemeService, overrides?: IColorMapping): IDisposable {
	return attachStyler(themeService, { ...defaultHighPerfTableStyles, ...(overrides || {}) }, widget);
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

export function attachEditableDropdownStyler(widget: IThemable, themeService: IThemeService, style?: {
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
}): IDisposable {
	return attachStyler(themeService, {
		listFocusBackground: (style && style.listFocusBackground) || cr.listFocusBackground,
		listFocusForeground: (style && style.listFocusForeground) || cr.listFocusForeground,
		listActiveSelectionBackground: (style && style.listActiveSelectionBackground) || cr.lighten(cr.listActiveSelectionBackground, 0.1),
		listActiveSelectionForeground: (style && style.listActiveSelectionForeground) || cr.listActiveSelectionForeground,
		listFocusAndSelectionBackground: style && style.listFocusAndSelectionBackground || cr.listActiveSelectionBackground,
		listFocusAndSelectionForeground: (style && style.listFocusAndSelectionForeground) || cr.listActiveSelectionForeground,
		listInactiveFocusBackground: (style && style.listInactiveFocusBackground),
		listInactiveSelectionBackground: (style && style.listInactiveSelectionBackground) || cr.listInactiveSelectionBackground,
		listInactiveSelectionForeground: (style && style.listInactiveSelectionForeground) || cr.listInactiveSelectionForeground,
		listHoverBackground: (style && style.listHoverBackground) || cr.listHoverBackground,
		listHoverForeground: (style && style.listHoverForeground) || cr.listHoverForeground,
		listDropBackground: (style && style.listDropBackground) || cr.listDropBackground,
		listFocusOutline: (style && style.listFocusOutline) || cr.activeContrastBorder,
		listSelectionOutline: (style && style.listSelectionOutline) || cr.activeContrastBorder,
		listHoverOutline: (style && style.listHoverOutline) || cr.activeContrastBorder,
		listInactiveFocusOutline: style && style.listInactiveFocusOutline,
		inputBackground: (style && style.inputBackground) || cr.inputBackground,
		inputForeground: (style && style.inputForeground) || cr.inputForeground,
		inputBorder: (style && style.inputBorder) || cr.inputBorder,
		inputValidationInfoBorder: (style && style.inputValidationInfoBorder) || cr.inputValidationInfoBorder,
		inputValidationInfoBackground: (style && style.inputValidationInfoBackground) || cr.inputValidationInfoBackground,
		inputValidationWarningBorder: (style && style.inputValidationWarningBorder) || cr.inputValidationWarningBorder,
		inputValidationWarningBackground: (style && style.inputValidationWarningBackground) || cr.inputValidationWarningBackground,
		inputValidationErrorBorder: (style && style.inputValidationErrorBorder) || cr.inputValidationErrorBorder,
		inputValidationErrorBackground: (style && style.inputValidationErrorBackground) || cr.inputValidationErrorBackground,
		contextBackground: (style && style.contextBackground) || cr.editorBackground,
		contextBorder: (style && style.contextBorder) || cr.inputBorder
	}, widget);
}

export function attachCheckboxStyler(widget: IThemable, themeService: IThemeService, style?: { disabledCheckboxForeground?: cr.ColorIdentifier })
	: IDisposable {
	return attachStyler(themeService, {
		disabledCheckboxForeground: (style && style.disabledCheckboxForeground) || colors.disabledCheckboxForeground
	}, widget);
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

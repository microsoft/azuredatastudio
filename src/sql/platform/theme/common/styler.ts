/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sqlcolors from './colors';

import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as cr from 'vs/platform/theme/common/colorRegistry';
import { attachStyler } from 'vs/platform/theme/common/styler';
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
		buttonFocusOutline: (style && style.buttonFocusOutline) || sqlcolors.buttonFocusOutline
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
		disabledInputBackground: (style && style.disabledInputBackground) || sqlcolors.disabledInputBackground,
		disabledInputForeground: (style && style.disabledInputForeground) || sqlcolors.disabledInputForeground,
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
		disabledSelectBackground: (style && style.disabledSelectBackground) || sqlcolors.disabledInputBackground,
		disabledSelectForeground: (style && style.disabledSelectForeground) || sqlcolors.disabledInputForeground,
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
		listFocusAndSelectionBackground: style && style.listFocusAndSelectionBackground || sqlcolors.listFocusAndSelectionBackground,
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
		tableHeaderBackground: (style && style.tableHeaderBackground) || sqlcolors.tableHeaderBackground,
		tableHeaderForeground: (style && style.tableHeaderForeground) || sqlcolors.tableHeaderForeground
	}, widget);
}

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

export function attachButtonStyler(widget: IThemable, themeService: IThemeService, style?: {
	buttonForeground?: cr.ColorIdentifier,
	buttonBackground?: cr.ColorIdentifier,
	buttonHoverBackground?: cr.ColorIdentifier,
	buttonFocusOutline?: cr.ColorIdentifier
}): IDisposable {
	return attachStyler(themeService, {
		buttonForeground: (style && style.buttonForeground) || cr.buttonForeground,
		buttonBackground: (style && style.buttonBackground) || cr.buttonBackground,
		buttonHoverBackground: (style && style.buttonHoverBackground) || cr.buttonHoverBackground,
		buttonBorder: cr.contrastBorder,
		buttonFocusOutline: (style && style.buttonFocusOutline) || sqlcolors.buttonFocusOutline
	}, widget);
}

export function attachCheckboxStyler(widget: IThemable, themeService: IThemeService, style?: { disabledCheckboxForeground?: cr.ColorIdentifier })
	: IDisposable {
	return attachStyler(themeService, {
		disabledCheckboxForeground: (style && style.disabledCheckboxForeground) || sqlcolors.disabledCheckboxForeground
	}, widget);
}

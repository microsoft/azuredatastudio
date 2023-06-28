/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as colors from './colors';

import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as cr from 'vs/platform/theme/common/colorRegistry';
import * as sqlcr from 'sql/platform/theme/common/colorRegistry';
import { IThemable, attachStyler, computeStyles, IStyleOverrides } from 'sql/platform/theme/common/vsstyler';
import { IDisposable } from 'vs/base/common/lifecycle';

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

export function attachDesignerStyler(widget: any, themeService: IThemeService): IDisposable {
	function applyStyles(): void {
		const colorTheme = themeService.getColorTheme();
		const selectBoxStyles = computeStyles(colorTheme, defaultSelectBoxStyles);
		const tableStyles = computeStyles(colorTheme, defaultTableStyles);
		widget.style({
			selectBoxStyles: selectBoxStyles,
			tableStyles: tableStyles,
			paneSeparator: cr.resolveColorValue(sqlcr.DesignerPaneSeparator, colorTheme),
			groupHeaderBackground: cr.resolveColorValue(sqlcr.GroupHeaderBackground, colorTheme)
		});
	}

	applyStyles();

	return themeService.onDidColorThemeChange(applyStyles);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color } from 'vs/base/common/color';
import { IDisposable } from 'vs/base/common/lifecycle';
import { activeContrastBorder, breadcrumbsActiveSelectionForeground, breadcrumbsBackground, breadcrumbsFocusForeground, breadcrumbsForeground, buttonBackground, buttonBorder, buttonForeground, buttonHoverBackground, buttonSecondaryBackground, buttonSecondaryForeground, buttonSecondaryHoverBackground, ColorIdentifier, ColorTransform, ColorValue, contrastBorder, editorWidgetBackground, editorWidgetForeground, inputActiveOptionBackground, inputActiveOptionBorder, inputActiveOptionForeground, inputBackground, inputBorder, inputForeground, inputValidationErrorBackground, inputValidationErrorBorder, inputValidationErrorForeground, inputValidationInfoBackground, inputValidationInfoBorder, inputValidationInfoForeground, inputValidationWarningBackground, inputValidationWarningBorder, inputValidationWarningForeground, keybindingLabelBackground, keybindingLabelBorder, keybindingLabelBottomBorder, keybindingLabelForeground, listActiveSelectionBackground, listActiveSelectionForeground, listActiveSelectionIconForeground, listDropBackground, listFilterWidgetBackground, listFilterWidgetNoMatchesOutline, listFilterWidgetOutline, listFocusBackground, listFocusForeground, listFocusOutline, listHoverBackground, listHoverForeground, listInactiveFocusBackground, listInactiveFocusOutline, listInactiveSelectionBackground, listInactiveSelectionForeground, listInactiveSelectionIconForeground, menuBackground, menuBorder, menuForeground, menuSelectionBackground, menuSelectionBorder, menuSelectionForeground, menuSeparatorBackground, problemsErrorIconForeground, problemsInfoIconForeground, problemsWarningIconForeground, progressBarBackground, resolveColorValue, scrollbarShadow, scrollbarSliderActiveBackground, scrollbarSliderBackground, scrollbarSliderHoverBackground, checkboxBackground, checkboxBorder, checkboxForeground, tableColumnsBorder, tableOddRowsBackgroundColor, textLinkForeground, treeIndentGuidesStroke, widgetShadow, listFocusAndSelectionOutline, listFilterWidgetShadow, buttonSeparator } from 'vs/platform/theme/common/colorRegistry'; // {{SQL CARBON EDIT}} Added buttonSecondaryBorder, buttonDisabledBorder, buttonDisabledBackground, buttonDisabledForeground to import list
import { IColorTheme, IThemeService } from 'vs/platform/theme/common/themeService';

//export type styleFn = (colors: { [name: string]: Color | undefined }) => void;
export type styleFn = (colors: any) => void;

export interface IThemable {
	style: styleFn;
}

export interface IStyleOverrides {
	[color: string]: ColorIdentifier | undefined;
}

export interface IColorMapping {
	[optionsKey: string]: ColorValue | undefined;
}

export interface IComputedStyles {
	[color: string]: string | Color | undefined;
}

export function computeStyles(theme: IColorTheme, styleMap: IColorMapping): IComputedStyles {
	const styles = Object.create(null) as IComputedStyles;
	for (const key in styleMap) {
		const value = styleMap[key];
		if (value) {
			let color: any = resolveColorValue(value, theme);
			if (color) {
				color = color.toString();
			}
			styles[key] = color;
		}
	}

	return styles;
}

export function attachStyler<T extends IColorMapping>(themeService: IThemeService, styleMap: T, widgetOrCallback: IThemable | styleFn): IDisposable {
	function applyStyles(): void {
		const styles = computeStyles(themeService.getColorTheme(), styleMap);

		if (typeof widgetOrCallback === 'function') {
			widgetOrCallback(styles);
		} else {
			widgetOrCallback.style(styles);
		}
	}

	applyStyles();

	return themeService.onDidColorThemeChange(applyStyles);
}

export interface IListStyleOverrides extends IStyleOverrides {
	listBackground?: ColorIdentifier;
	listFocusBackground?: ColorIdentifier;
	listFocusForeground?: ColorIdentifier;
	listFocusOutline?: ColorIdentifier;
	listActiveSelectionBackground?: ColorIdentifier;
	listActiveSelectionForeground?: ColorIdentifier;
	listActiveSelectionIconForeground?: ColorIdentifier;
	listFocusAndSelectionOutline?: ColorIdentifier;
	listFocusAndSelectionBackground?: ColorIdentifier;
	listFocusAndSelectionForeground?: ColorIdentifier;
	listInactiveSelectionBackground?: ColorIdentifier;
	listInactiveSelectionIconForeground?: ColorIdentifier;
	listInactiveSelectionForeground?: ColorIdentifier;
	listInactiveFocusBackground?: ColorIdentifier;
	listInactiveFocusOutline?: ColorIdentifier;
	listHoverBackground?: ColorIdentifier;
	listHoverForeground?: ColorIdentifier;
	listDropBackground?: ColorIdentifier;
	listSelectionOutline?: ColorIdentifier;
	listHoverOutline?: ColorIdentifier;
	listFilterWidgetBackground?: ColorIdentifier;
	listFilterWidgetOutline?: ColorIdentifier;
	listFilterWidgetNoMatchesOutline?: ColorIdentifier;
	listFilterWidgetShadow?: ColorIdentifier;
	treeIndentGuidesStroke?: ColorIdentifier;
	tableColumnsBorder?: ColorIdentifier;
	tableOddRowsBackgroundColor?: ColorIdentifier;
}

export function attachListStyler(widget: IThemable, themeService: IThemeService, overrides?: IColorMapping): IDisposable {
	return attachStyler(themeService, { ...defaultListStyles, ...(overrides || {}) }, widget);
}

export const defaultListStyles: IColorMapping = {
	listFocusBackground,
	listFocusForeground,
	listFocusOutline,
	listActiveSelectionBackground,
	listActiveSelectionForeground,
	listActiveSelectionIconForeground,
	listFocusAndSelectionOutline,
	listFocusAndSelectionBackground: listActiveSelectionBackground,
	listFocusAndSelectionForeground: listActiveSelectionForeground,
	listInactiveSelectionBackground,
	listInactiveSelectionIconForeground,
	listInactiveSelectionForeground,
	listInactiveFocusBackground,
	listInactiveFocusOutline,
	listHoverBackground,
	listHoverForeground,
	listDropBackground,
	listSelectionOutline: activeContrastBorder,
	listHoverOutline: activeContrastBorder,
	listFilterWidgetBackground,
	listFilterWidgetOutline,
	listFilterWidgetNoMatchesOutline,
	listFilterWidgetShadow,
	treeIndentGuidesStroke,
	tableColumnsBorder,
	tableOddRowsBackgroundColor,
	inputActiveOptionBorder,
	inputActiveOptionForeground,
	inputActiveOptionBackground,
	inputBackground,
	inputForeground,
	inputBorder,
	inputValidationInfoBackground,
	inputValidationInfoForeground,
	inputValidationInfoBorder,
	inputValidationWarningBackground,
	inputValidationWarningForeground,
	inputValidationWarningBorder,
	inputValidationErrorBackground,
	inputValidationErrorForeground,
	inputValidationErrorBorder,
};

export interface IKeybindingLabelStyleOverrides extends IStyleOverrides {
	keybindingLabelBackground?: ColorIdentifier;
	keybindingLabelForeground?: ColorIdentifier;
	keybindingLabelBorder?: ColorIdentifier;
	keybindingLabelBottomBorder?: ColorIdentifier;
	keybindingLabelShadow?: ColorIdentifier;
}

export function attachKeybindingLabelStyler(widget: IThemable, themeService: IThemeService, style?: IKeybindingLabelStyleOverrides): IDisposable {
	return attachStyler(themeService, {
		keybindingLabelBackground: (style && style.keybindingLabelBackground) || keybindingLabelBackground,
		keybindingLabelForeground: (style && style.keybindingLabelForeground) || keybindingLabelForeground,
		keybindingLabelBorder: (style && style.keybindingLabelBorder) || keybindingLabelBorder,
		keybindingLabelBottomBorder: (style && style.keybindingLabelBottomBorder) || keybindingLabelBottomBorder,
		keybindingLabelShadow: (style && style.keybindingLabelShadow) || widgetShadow
	} as IKeybindingLabelStyleOverrides, widget);
}

export interface IProgressBarStyleOverrides extends IStyleOverrides {
	progressBarBackground?: ColorIdentifier;
}

export function attachProgressBarStyler(widget: IThemable, themeService: IThemeService, style?: IProgressBarStyleOverrides): IDisposable {
	return attachStyler(themeService, {
		progressBarBackground: style?.progressBarBackground || progressBarBackground
	} as IProgressBarStyleOverrides, widget);
}

export function attachStylerCallback(themeService: IThemeService, colors: { [name: string]: ColorIdentifier }, callback: styleFn): IDisposable {
	return attachStyler(themeService, colors, callback);
}

export interface IBreadcrumbsWidgetStyleOverrides extends IColorMapping {
	breadcrumbsBackground?: ColorIdentifier | ColorTransform;
	breadcrumbsForeground?: ColorIdentifier;
	breadcrumbsHoverForeground?: ColorIdentifier;
	breadcrumbsFocusForeground?: ColorIdentifier;
	breadcrumbsFocusAndSelectionForeground?: ColorIdentifier;
}

export const defaultBreadcrumbsStyles = <IBreadcrumbsWidgetStyleOverrides>{
	breadcrumbsBackground: breadcrumbsBackground,
	breadcrumbsForeground: breadcrumbsForeground,
	breadcrumbsHoverForeground: breadcrumbsFocusForeground,
	breadcrumbsFocusForeground: breadcrumbsFocusForeground,
	breadcrumbsFocusAndSelectionForeground: breadcrumbsActiveSelectionForeground,
};

export function attachBreadcrumbsStyler(widget: IThemable, themeService: IThemeService, style?: IBreadcrumbsWidgetStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultBreadcrumbsStyles, ...style }, widget);
}

export interface IMenuStyleOverrides extends IColorMapping {
	shadowColor?: ColorIdentifier;
	borderColor?: ColorIdentifier;
	foregroundColor?: ColorIdentifier;
	backgroundColor?: ColorIdentifier;
	selectionForegroundColor?: ColorIdentifier;
	selectionBackgroundColor?: ColorIdentifier;
	selectionBorderColor?: ColorIdentifier;
	separatorColor?: ColorIdentifier;
}

export const defaultMenuStyles = <IMenuStyleOverrides>{
	shadowColor: widgetShadow,
	borderColor: menuBorder,
	foregroundColor: menuForeground,
	backgroundColor: menuBackground,
	selectionForegroundColor: menuSelectionForeground,
	selectionBackgroundColor: menuSelectionBackground,
	selectionBorderColor: menuSelectionBorder,
	separatorColor: menuSeparatorBackground,
	scrollbarShadow: scrollbarShadow,
	scrollbarSliderBackground: scrollbarSliderBackground,
	scrollbarSliderHoverBackground: scrollbarSliderHoverBackground,
	scrollbarSliderActiveBackground: scrollbarSliderActiveBackground
};

export function attachMenuStyler(widget: IThemable, themeService: IThemeService, style?: IMenuStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultMenuStyles, ...style }, widget);
}

export interface IDialogStyleOverrides {
	dialogForeground?: ColorIdentifier;
	dialogBackground?: ColorIdentifier;
	dialogShadow?: ColorIdentifier;
	dialogBorder?: ColorIdentifier;
	checkboxBorder?: ColorIdentifier;
	checkboxBackground?: ColorIdentifier;
	checkboxForeground?: ColorIdentifier;
	errorIconForeground?: ColorIdentifier;
	warningIconForeground?: ColorIdentifier;
	infoIconForeground?: ColorIdentifier;
	inputBackground?: ColorIdentifier;
	inputForeground?: ColorIdentifier;
	inputBorder?: ColorIdentifier;
}

export const defaultDialogStyles = <IDialogStyleOverrides>{
	dialogBackground: editorWidgetBackground,
	dialogForeground: editorWidgetForeground,
	dialogShadow: widgetShadow,
	dialogBorder: contrastBorder,
	buttonForeground: buttonForeground,
	buttonSeparator: buttonSeparator,
	buttonBackground: buttonBackground,
	buttonSecondaryBackground: buttonSecondaryBackground,
	buttonSecondaryForeground: buttonSecondaryForeground,
	buttonSecondaryHoverBackground: buttonSecondaryHoverBackground,
	buttonHoverBackground: buttonHoverBackground,
	buttonBorder: buttonBorder,
	checkboxBorder: checkboxBorder,
	checkboxBackground: checkboxBackground,
	checkboxForeground: checkboxForeground,
	errorIconForeground: problemsErrorIconForeground,
	warningIconForeground: problemsWarningIconForeground,
	infoIconForeground: problemsInfoIconForeground,
	inputBackground: inputBackground,
	inputForeground: inputForeground,
	inputBorder: inputBorder,
	textLinkForeground: textLinkForeground
};


export function attachDialogStyler(widget: IThemable, themeService: IThemeService, style?: IDialogStyleOverrides): IDisposable {
	return attachStyler(themeService, { ...defaultDialogStyles, ...style }, widget);
}

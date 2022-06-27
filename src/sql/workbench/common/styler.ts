/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as cr from 'vs/platform/theme/common/colorRegistry';
import * as sqlcr from 'sql/platform/theme/common/colorRegistry';
import { IThemable } from 'vs/base/common/styler';
import { attachStyler, IStyleOverrides } from 'vs/platform/theme/common/styler';
import {
	SIDE_BAR_SECTION_HEADER_FOREGROUND, SIDE_BAR_BACKGROUND, SIDE_BAR_SECTION_HEADER_BACKGROUND, SIDE_BAR_DRAG_AND_DROP_BACKGROUND,
	PANEL_ACTIVE_TITLE_BORDER, PANEL_ACTIVE_TITLE_FOREGROUND, PANEL_INACTIVE_TITLE_FOREGROUND
} from 'vs/workbench/common/theme';
import { VERTICAL_TAB_ACTIVE_BACKGROUND, DASHBOARD_BORDER } from 'sql/workbench/common/theme';

export interface IModalDialogStyleOverrides extends IStyleOverrides {
	dialogForeground?: cr.ColorIdentifier,
	dialogHeaderAndFooterBackground?: cr.ColorIdentifier,
	dialogBodyBackground?: cr.ColorIdentifier,
	dialogBorder?: cr.ColorIdentifier,
	dialogInteriorBorder?: cr.ColorIdentifier,
	dialogExteriorBorder?: cr.ColorIdentifier,
	dialogShadowColor?: cr.ColorIdentifier
}

export function attachModalDialogStyler(widget: IThemable, themeService: IThemeService, style?: IModalDialogStyleOverrides): IDisposable {
	return attachStyler(themeService, {
		dialogForeground: (style && style.dialogForeground) || cr.foreground,
		dialogBorder: cr.contrastBorder,
		dialogHeaderAndFooterBackground: (style && style.dialogHeaderAndFooterBackground) || SIDE_BAR_BACKGROUND,
		dialogBodyBackground: (style && style.dialogBodyBackground) || cr.editorBackground
	} as IModalDialogStyleOverrides, widget);
}

export function attachPanelStyler(widget: IThemable, themeService: IThemeService) {
	return attachStyler(themeService, {
		headerForeground: SIDE_BAR_SECTION_HEADER_FOREGROUND,
		headerBackground: SIDE_BAR_SECTION_HEADER_BACKGROUND,
		// headerHighContrastBorder: index === 0 ? null : contrastBorder,
		dropBackground: SIDE_BAR_DRAG_AND_DROP_BACKGROUND
	}, widget);
}

export function attachTabbedPanelStyler(widget: IThemable, themeService: IThemeService) {
	return attachStyler(themeService, {
		titleSelectedForeground: PANEL_ACTIVE_TITLE_FOREGROUND,
		titleSelectedBorder: PANEL_ACTIVE_TITLE_BORDER,
		titleUnSelectedForeground: PANEL_INACTIVE_TITLE_FOREGROUND,
		focusBorder: cr.focusBorder,
		outline: cr.activeContrastBorder,
		selectedBackgroundForVerticalLayout: VERTICAL_TAB_ACTIVE_BACKGROUND,
		border: DASHBOARD_BORDER,
		selectedTabContrastBorder: cr.activeContrastBorder
	}, widget);
}

export function attachCalloutDialogStyler(widget: IThemable, themeService: IThemeService, style?: IModalDialogStyleOverrides): IDisposable {
	return attachStyler(themeService, {
		dialogForeground: (style && style.dialogForeground) || sqlcr.calloutDialogForeground,
		dialogHeaderAndFooterBackground: (style && style.dialogHeaderAndFooterBackground) || sqlcr.calloutDialogHeaderFooterBackground,
		dialogBodyBackground: (style && style.dialogBodyBackground) || sqlcr.calloutDialogBodyBackground,
		dialogInteriorBorder: (style && style.dialogInteriorBorder) || sqlcr.calloutDialogInteriorBorder,
		dialogExteriorBorder: (style && style.dialogExteriorBorder) || sqlcr.calloutDialogExteriorBorder,
		dialogShadowColor: (style && style.dialogShadowColor) || sqlcr.calloutDialogShadowColor
	} as IModalDialogStyleOverrides, widget);
}

export function attachCustomDialogStyler(widget: IThemable, themeService: IThemeService, dialogStyle?: string, style?: IModalDialogStyleOverrides): IDisposable {
	if (dialogStyle === 'callout') {
		return attachStyler(themeService, {
			dialogForeground: (style && style.dialogForeground) || sqlcr.calloutDialogForeground,
			dialogHeaderAndFooterBackground: (style && style.dialogHeaderAndFooterBackground) || sqlcr.calloutDialogHeaderFooterBackground,
			dialogBodyBackground: (style && style.dialogBodyBackground) || sqlcr.calloutDialogBodyBackground,
			dialogInteriorBorder: (style && style.dialogInteriorBorder) || sqlcr.calloutDialogInteriorBorder,
			dialogExteriorBorder: (style && style.dialogExteriorBorder) || sqlcr.calloutDialogExteriorBorder,
			dialogShadowColor: (style && style.dialogShadowColor) || sqlcr.calloutDialogShadowColor
		} as IModalDialogStyleOverrides, widget);
	} else {
		return attachStyler(themeService, {
			dialogForeground: (style && style.dialogForeground) || cr.foreground,
			dialogBorder: cr.contrastBorder,
			dialogHeaderAndFooterBackground: (style && style.dialogHeaderAndFooterBackground) || SIDE_BAR_BACKGROUND,
			dialogBodyBackground: (style && style.dialogBodyBackground) || cr.editorBackground
		} as IModalDialogStyleOverrides, widget);
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as cr from 'vs/platform/theme/common/colorRegistry';
import { IThemable } from 'vs/base/common/styler';
import { attachStyler } from 'vs/platform/theme/common/styler';
import {
	SIDE_BAR_SECTION_HEADER_FOREGROUND, SIDE_BAR_BACKGROUND, SIDE_BAR_SECTION_HEADER_BACKGROUND, SIDE_BAR_DRAG_AND_DROP_BACKGROUND,
	PANEL_ACTIVE_TITLE_BORDER, PANEL_ACTIVE_TITLE_FOREGROUND, PANEL_INACTIVE_TITLE_FOREGROUND, VERTICAL_TAB_ACTIVE_BACKGROUND, DASHBOARD_BORDER,

} from 'vs/workbench/common/theme';

export function attachModalDialogStyler(widget: IThemable, themeService: IThemeService, style?:
	{
		dialogForeground?: cr.ColorIdentifier,
		dialogHeaderAndFooterBackground?: cr.ColorIdentifier,
		dialogBodyBackground?: cr.ColorIdentifier,
	}): IDisposable {
	return attachStyler(themeService, {
		dialogForeground: (style && style.dialogForeground) || cr.foreground,
		dialogBorder: cr.contrastBorder,
		dialogHeaderAndFooterBackground: (style && style.dialogHeaderAndFooterBackground) || SIDE_BAR_BACKGROUND,
		dialogBodyBackground: (style && style.dialogBodyBackground) || cr.editorBackground
	}, widget);
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
		titleActiveForeground: PANEL_ACTIVE_TITLE_FOREGROUND,
		titleActiveBorder: PANEL_ACTIVE_TITLE_BORDER,
		titleInactiveForeground: PANEL_INACTIVE_TITLE_FOREGROUND,
		focusBorder: cr.focusBorder,
		outline: cr.activeContrastBorder,
		activeBackgroundForVerticalLayout: VERTICAL_TAB_ACTIVE_BACKGROUND,
		border: DASHBOARD_BORDER,
		activeTabContrastBorder: cr.activeContrastBorder
	}, widget);
}

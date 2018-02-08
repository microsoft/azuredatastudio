/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/panel';

import { registerThemingParticipant, ITheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { PANEL_ACTIVE_TITLE_FOREGROUND, PANEL_INACTIVE_TITLE_FOREGROUND, PANEL_ACTIVE_TITLE_BORDER } from 'vs/workbench/common/theme';
import { activeContrastBorder, focusBorder } from 'vs/platform/theme/common/colorRegistry';

registerThemingParticipant((theme: ITheme, collector: ICssStyleCollector) => {

	// Title Active
	const titleActive = theme.getColor(PANEL_ACTIVE_TITLE_FOREGROUND);
	const titleActiveBorder = theme.getColor(PANEL_ACTIVE_TITLE_BORDER);
	if (titleActive || titleActiveBorder) {
		collector.addRule(`
			.tabbedPanel > .title > .tabList .tab:hover .tabLabel,
			.tabbedPanel > .title > .tabList .tab .tabLabel.active {
				color: ${titleActive};
				border-bottom-color: ${titleActiveBorder};
			}

			.tabbedPanel > .title > .tabList .tab-header.active {
				outline: none;
			}
		`);
	}

	// Title Inactive
	const titleInactive = theme.getColor(PANEL_INACTIVE_TITLE_FOREGROUND);
	if (titleInactive) {
		collector.addRule(`
			.tabbedPanel > .title > .tabList .tab .tabLabel {
				color: ${titleInactive};
			}
		`);
	}

	// Title focus
	const focusBorderColor = theme.getColor(focusBorder);
	if (focusBorderColor) {
		collector.addRule(`
			.tabbedPanel > .title > .tabList .tab .tabLabel:focus {
				color: ${titleActive};
				border-bottom-color: ${focusBorderColor} !important;
				border-bottom: 1px solid;
				outline: none;
			}
		`);
	}

	// Styling with Outline color (e.g. high contrast theme)
	const outline = theme.getColor(activeContrastBorder);
	if (outline) {
		collector.addRule(`
			.tabbedPanel > .title > .tabList .tab-header.active,
			.tabbedPanel > .title > .tabList .tab-header:hover {
				outline-color: ${outline};
				outline-width: 1px;
				outline-style: solid;
				padding-bottom: 0;
				outline-offset: -5px;
			}

			.tabbedPanel > .title > .tabList .tab-header:hover:not(.active) {
				outline-style: dashed;
			}
		`);
	}
});
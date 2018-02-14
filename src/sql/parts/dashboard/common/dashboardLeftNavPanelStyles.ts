/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./dashboardLeftNavPanel';

import { registerThemingParticipant, ITheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { TAB_ACTIVE_BACKGROUND, TAB_ACTIVE_FOREGROUND, TAB_ACTIVE_BORDER, TAB_INACTIVE_BACKGROUND, TAB_INACTIVE_FOREGROUND, EDITOR_GROUP_HEADER_TABS_BACKGROUND, TAB_BORDER } from 'vs/workbench/common/theme';
import { activeContrastBorder, focusBorder } from 'vs/platform/theme/common/colorRegistry';

registerThemingParticipant((theme: ITheme, collector: ICssStyleCollector) => {

	// Title Active
	const tabActiveBackground = theme.getColor(TAB_ACTIVE_BACKGROUND);
	const tabActiveForeground = theme.getColor(TAB_ACTIVE_FOREGROUND);
	if (tabActiveBackground || tabActiveForeground) {
		collector.addRule(`
			panel.dashboard-left-nav > .tabbedPanel > .title > .tabList .tab:hover .tabLabel,
			panel.dashboard-left-nav > .tabbedPanel > .title > .tabList .tab .tabLabel.active {
				color: ${tabActiveForeground};
				border-bottom: 0px solid;
			}

			panel.dashboard-left-nav > .tabbedPanel > .title > .tabList .tab-header.active {
				background-color: ${tabActiveBackground};
			}
		`);
	}

	const activeTabBorderColor = theme.getColor(TAB_ACTIVE_BORDER);
	if (activeTabBorderColor) {
		collector.addRule(`
			panel.dashboard-left-nav > .tabbedPanel > .title > .tabList .tab-header.active {
				box-shadow: ${activeTabBorderColor} 0 -1px inset;
			}
		`);
	}

	// Title Inactive
	const tabInactiveBackground = theme.getColor(TAB_INACTIVE_BACKGROUND);
	const tabInactiveForeground = theme.getColor(TAB_INACTIVE_FOREGROUND);
	if (tabInactiveBackground || tabInactiveForeground) {
		collector.addRule(`
			panel.dashboard-left-nav > .tabbedPanel > .title > .tabList .tab .tabLabel {
				color: ${tabInactiveForeground};
			}

			panel.dashboard-left-nav > .tabbedPanel > .title > .tabList .tab-header {
				background-color: ${tabInactiveBackground};
			}
		`);
	}

	// Panel title background
	const panelTitleBackground = theme.getColor(EDITOR_GROUP_HEADER_TABS_BACKGROUND);
	if (panelTitleBackground) {
		collector.addRule(`
			panel.dashboard-left-nav > .tabbedPanel > .title {
				background-color: ${panelTitleBackground};
			}
		`);
	}

	// Panel title background
	const tabBoarder = theme.getColor(TAB_BORDER);
	if (tabBoarder) {
		collector.addRule(`
			panel.dashboard-left-nav > .tabbedPanel > .title > .tabList .tab-header {
				border-bottom-color: ${tabBoarder};
			}
		`);
	}

	// Styling with Outline color (e.g. high contrast theme)
	const outline = theme.getColor(activeContrastBorder);
	if (outline) {
		collector.addRule(`
			panel.dashboard-left-nav > .tabbedPanel > .title {
				border-bottom-color: ${tabBoarder};
				border-bottom-width: 1px;
				border-bottom-style: solid;
				border-right-color: ${tabBoarder};
				border-right-width: 1px;
				border-right-style: solid;
			}
		`);
	}
});
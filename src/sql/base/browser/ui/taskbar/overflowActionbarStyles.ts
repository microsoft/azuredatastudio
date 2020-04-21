/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// eslint-disable-next-line code-import-patterns
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
// eslint-disable-next-line code-import-patterns
import { EDITOR_PANE_BACKGROUND, DASHBOARD_BORDER, TOOLBAR_OVERFLOW_SHADOW } from 'vs/workbench/common/theme';
// eslint-disable-next-line code-import-patterns
import { focusBorder } from 'vs/platform/theme/common/colorRegistry';

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const overflowBackground = theme.getColor(EDITOR_PANE_BACKGROUND);
	if (overflowBackground) {
		collector.addRule(`.carbon-taskbar .overflow {
			background-color: ${overflowBackground};
		}`);
	}

	const overflowShadow = theme.getColor(TOOLBAR_OVERFLOW_SHADOW);
	if (overflowShadow) {
		collector.addRule(`.carbon-taskbar .overflow {
			box-shadow: 0px 4px 4px ${overflowShadow};
		}`);
	}

	const border = theme.getColor(DASHBOARD_BORDER);
	if (border) {
		collector.addRule(`.carbon-taskbar .overflow {
			border: 1px solid ${border};
		}`);
	}

	const activeOutline = theme.getColor(focusBorder);
	if (activeOutline) {
		collector.addRule(`.carbon-taskbar .overflow li.focused {
			outline: 1px solid;
			outline-offset: -3px;
			outline-color: ${activeOutline}
		}`);
	}
});

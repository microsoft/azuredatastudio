/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { EDITOR_PANE_BACKGROUND, DASHBOARD_BORDER, TOOLBAR_OVERFLOW_SHADOW } from 'vs/workbench/common/theme';

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
});

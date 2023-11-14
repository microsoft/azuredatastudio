/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DASHBOARD_WIDGET_TITLE, DASHBOARD_WIDGET_SUBTEXT } from 'sql/workbench/common/theme';
import 'vs/css!./dashboardPanel';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	// widget title
	const widgetTitle = theme.getColor(DASHBOARD_WIDGET_TITLE);
	if (widgetTitle) {
		collector.addRule(`dashboard-widget-wrapper .header {
			color: ${widgetTitle};
		}`);
	}

	// widget subtext
	const subText = theme.getColor(DASHBOARD_WIDGET_SUBTEXT);
	if (subText) {
		collector.addRule(`.subText {
			color: ${subText};
		}`);
	}
});

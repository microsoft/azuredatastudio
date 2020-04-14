/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardPanel';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { DASHBOARD_WIDGET_SUBTEXT, TAB_LABEL, DASHBOARD_WIDGET_TITLE, DASHBOARD_PROPERTIES_NAME } from 'vs/workbench/common/theme';

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	// tab label
	const tabLabelColor = theme.getColor(TAB_LABEL);
	if (tabLabelColor) {
		collector.addRule(`properties-widget .propertiesValue {
			color: ${tabLabelColor}
		}`);
	}

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

	// properties name
	const propertiesName = theme.getColor(DASHBOARD_PROPERTIES_NAME);
	if (propertiesName) {
		collector.addRule(`properties-widget .propertiesName {
			color: ${propertiesName}
		}`);
	}
});

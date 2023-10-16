/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { registerColor, contrastBorder } from 'vs/platform/theme/common/colorRegistry';
import { Color, RGBA } from 'vs/base/common/color';
import { TAB_ACTIVE_BACKGROUND } from 'vs/workbench/common/theme';

export const VERTICAL_TAB_ACTIVE_BACKGROUND = registerColor('tab.verticalTabActiveBackground', {
	dark: '#444444',
	light: '#e1f0fe',
	hcDark: TAB_ACTIVE_BACKGROUND,
	hcLight: TAB_ACTIVE_BACKGROUND
}, localize('verticalTabActiveBackground', "Active tab background color for vertical tabs"));

export const DASHBOARD_BORDER = registerColor('dashboard.border', {
	dark: '#8A8886',
	light: '#DDDDDD',
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('dashboardBorder', "Color for borders in dashboard"));

export const DASHBOARD_WIDGET_TITLE = registerColor('dashboardWidget.title', {
	light: '#323130',
	dark: '#FFFFFF',
	hcDark: '#FFFFFF',
	hcLight: '#000000'
}, localize('dashboardWidget', 'Color of dashboard widget title'));

export const DASHBOARD_WIDGET_SUBTEXT = registerColor('dashboardWidget.subText', {
	light: '#484644',
	dark: '#8A8886',
	hcDark: '#FFFFFF',
	hcLight: '#000000'
}, localize('dashboardWidgetSubtext', "Color for dashboard widget subtext"));

export const PROPERTIES_CONTAINER_PROPERTY_VALUE = registerColor('propertiesContainer.propertyValue', {
	light: '#000000',
	dark: 'FFFFFF',
	hcDark: 'FFFFFF',
	hcLight: '000000'
}, localize('propertiesContainerPropertyValue', "Color for property values displayed in the properties container component"));

export const PROPERTIES_CONTAINER_PROPERTY_NAME = registerColor('propertiesContainer.propertyName', {
	light: '#161616',
	dark: '#8A8886',
	hcDark: '#FFFFFF',
	hcLight: '#000000'
}, localize('propertiesContainerPropertyName', "Color for property names displayed in the properties container component"));

export const TOOLBAR_OVERFLOW_SHADOW = registerColor('toolbar.overflowShadow', {
	light: new Color(new RGBA(0, 0, 0, .132)),
	dark: new Color(new RGBA(0, 0, 0, 0.25)),
	hcDark: null,
	hcLight: null
}, localize('toolbarOverflowShadow', "Toolbar overflow shadow color"));

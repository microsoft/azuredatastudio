/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';
import { DASHBOARD_CONFIG_ID } from 'sql/parts/dashboard/pages/dashboardPageContribution';
import { DATABASE_DASHBOARD_SETTING, DATABASE_DASHBOARD_PROPERTIES, DATABASE_DASHBOARD_TABS, databaseDashboardSettingSchema, databaseDashboardPropertiesSchema, databaseDashboardTabsSchema } from 'sql/parts/dashboard/pages/databaseDashboardPage.contribution';
import { SERVER_DASHBOARD_SETTING, SERVER_DASHBOARD_PROPERTIES, SERVER_DASHBOARD_TABS, serverDashboardSettingSchema, serverDashboardPropertiesSchema, serverDashboardTabsSchema } from 'sql/parts/dashboard/pages/serverDashboardPage.contribution';

const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
const dashboardConfig: IConfigurationNode = {
	id: DASHBOARD_CONFIG_ID,
	type: 'object',
	properties: {
		[DATABASE_DASHBOARD_PROPERTIES]: databaseDashboardPropertiesSchema,
		[SERVER_DASHBOARD_PROPERTIES]: serverDashboardPropertiesSchema,
		[DATABASE_DASHBOARD_SETTING]: databaseDashboardSettingSchema,
		[SERVER_DASHBOARD_SETTING]: serverDashboardSettingSchema,
		[DATABASE_DASHBOARD_TABS]: databaseDashboardTabsSchema,
		[SERVER_DASHBOARD_TABS]: serverDashboardTabsSchema
	}
};

configurationRegistry.registerConfiguration(dashboardConfig);

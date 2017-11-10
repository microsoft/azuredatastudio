/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';
import { DATABASE_DASHBOARD_SETTING, DATABASE_DASHBOARD_PROPERTIES, databaseDashboardSettingSchema, databaseDashboardPropertiesSchema } from 'sql/parts/dashboard/pages/databaseDashboardPage.contribution';
import { SERVER_DASHBOARD_SETTING, SERVER_DASHBOARD_PROPERTIES, serverDashboardSettingSchema, serverDashboardPropertiesSchema } from 'sql/parts/dashboard/pages/serverDashboardPage.contribution';

const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
const dashboardConfig: IConfigurationNode = {
	id: 'Dashboard',
	type: 'object',
	properties: {
		[DATABASE_DASHBOARD_PROPERTIES]: databaseDashboardPropertiesSchema,
		[SERVER_DASHBOARD_PROPERTIES]: serverDashboardPropertiesSchema,
		[DATABASE_DASHBOARD_SETTING]: databaseDashboardSettingSchema,
		[SERVER_DASHBOARD_SETTING]: serverDashboardSettingSchema
	}
};

configurationRegistry.registerConfiguration(dashboardConfig);

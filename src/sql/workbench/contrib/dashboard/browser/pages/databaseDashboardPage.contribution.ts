/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';
import { generateDashboardWidgetSchema, generateDashboardTabSchema } from './dashboardPageContribution';

export const databaseDashboardPropertiesSchema: IJSONSchema = {
	description: nls.localize('dashboardDatabaseProperties', "Enable or disable the properties widget"),
	default: true,
	oneOf: <IJSONSchema[]>[
		{ type: 'boolean' },
		{
			type: 'string',
			enum: ['collapsed']
		},
		{
			type: 'array',
			items: {
				type: 'object',
				properties: {
					provider: {
						type: 'string'
					},
					edition: {
						type: 'number'
					},
					properties: {
						description: nls.localize('dashboard.databaseproperties', "Property values to show"),
						type: 'array',
						items: {
							type: 'object',
							properties: {
								displayName: {
									type: 'string',
									description: nls.localize('dashboard.databaseproperties.displayName', "Display name of the property")
								},
								value: {
									type: 'string',
									description: nls.localize('dashboard.databaseproperties.value', "Value in the Database Info Object")
								},
								ignore: {
									type: 'array',
									description: nls.localize('dashboard.databaseproperties.ignore', "Specify specific values to ignore"),
									items: 'string'
								}
							}
						},
						default: [
							{
								displayName: nls.localize('recoveryModel', "Recovery Model"),
								value: 'recoveryModel'
							},
							{
								displayName: nls.localize('lastDatabaseBackup', "Last Database Backup"),
								value: 'lastBackupDate',
								ignore: [
									'1/1/0001 12:00:00 AM'
								]
							},
							{
								displayName: nls.localize('lastLogBackup', "Last Log Backup"),
								value: 'lastLogBackupDate',
								ignore: [
									'1/1/0001 12:00:00 AM'
								]
							},
							{
								displayName: nls.localize('compatibilityLevel', "Compatibility Level"),
								value: 'compatibilityLevel'
							},
							{
								displayName: nls.localize('owner', "Owner"),
								value: 'owner'
							}
						]
					}
				}
			}
		}
	]
};

export const databaseDashboardSettingSchema: IJSONSchema = {
	type: ['array'],
	description: nls.localize('dashboardDatabase', "Customizes the database dashboard page"),
	items: generateDashboardWidgetSchema('database'),
	default: [
		{
			name: 'Tasks',
			gridItemConfig: {
				sizex: 1,
				sizey: 2
			},
			widget: {
				'tasks-widget': [
					'newQuery',
					'mssqlCluster.task.newNotebook',
					{ name: 'backup', when: 'connectionProvider == \'MSSQL\' && !mssql:iscloud && mssql:engineedition != 11' },
					{ name: 'restore', when: 'connectionProvider == \'MSSQL\' && !mssql:iscloud && mssql:engineedition != 11' }
				]
			}
		},
		{
			name: nls.localize('objectsWidgetTitle', "Search"),
			gridItemConfig: {
				sizex: 3,
				sizey: 2
			},
			widget: {
				'explorer-widget': {}
			}
		}
	]
};

export const databaseDashboardTabsSchema: IJSONSchema = {
	type: ['array'],
	description: nls.localize('dashboardDatabaseTabs', "Customizes the database dashboard tabs"),
	items: generateDashboardTabSchema('database'),
	default: [
	]
};

export const DATABASE_DASHBOARD_SETTING = 'dashboard.database.widgets';
export const DATABASE_DASHBOARD_PROPERTIES = 'dashboard.database.properties';
export const DATABASE_DASHBOARD_TABS = 'dashboard.database.tabs';

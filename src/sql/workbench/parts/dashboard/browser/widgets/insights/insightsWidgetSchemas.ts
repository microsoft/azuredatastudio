/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsightRegistry, Extensions as InsightExtensions } from 'sql/platform/dashboard/browser/insightRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { Registry } from 'vs/platform/registry/common/platform';
import * as nls from 'vs/nls';

const insightRegistry = Registry.as<IInsightRegistry>(InsightExtensions.InsightContribution);

export const insightsSchema: IJSONSchema = {
	type: 'object',
	description: nls.localize('insightWidgetDescription', "Adds a widget that can query a server or database and display the results in multiple ways - as a chart, summarized count, and more"),
	properties: {
		cacheId: {
			type: 'string',
			description: nls.localize('insightIdDescription', "Unique Identifier used for caching the results of the insight.")
		},
		type: {
			type: 'object',
			properties: insightRegistry.insightSchema.properties,
			minItems: 1,
			maxItems: 1
		},
		query: {
			type: ['string', 'array'],
			description: nls.localize('insightQueryDescription', "SQL query to run. This should return exactly 1 resultset.")
		},
		queryFile: {
			type: 'string',
			description: nls.localize('insightQueryFileDescription', "[Optional] path to a file that contains a query. Use if 'query' is not set")
		},
		autoRefreshInterval: {
			type: 'number',
			description: nls.localize('insightAutoRefreshIntervalDescription', "[Optional] Auto refresh interval in minutes, if not set, there will be no auto refresh")
		},
		details: {
			type: 'object',
			properties: {
				query: {
					type: ['string', 'array']
				},
				queryFile: {
					type: 'string'
				},
				value: {
					type: 'string'
				},
				label: {
					type: ['string', 'object'],
					properties: {
						column: {
							type: 'string'
						},
						icon: {
							type: 'string'
						},
						state: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									condition: {
										type: 'object',
										properties: {
											if: {
												type: 'string',
												enum: ['equals', 'notEquals', 'greaterThanOrEquals', 'greaterThan', 'lessThanOrEquals', 'lessThan', 'always']
											},
											equals: {
												type: 'string'
											}
										}
									},
									color: {
										type: 'string'
									},
									icon: {
										type: 'string'
									}
								}
							}
						}
					}
				},
				actions: {
					type: 'object',
					properties: {
						types: {
							description: nls.localize('actionTypes', "Which actions to use"),
							type: 'array',
							items: {
								type: 'string'
							}
						},
						database: {
							type: 'string',
							description: nls.localize('actionDatabaseDescription', "Target database for the action; can use the format '${ columnName }' to use a data driven column name.")
						},
						server: {
							type: 'string',
							description: nls.localize('actionServerDescription', "Target server for the action; can use the format '${ columnName }' to use a data driven column name.")
						},
						user: {
							type: 'string',
							description: nls.localize('actionUserDescription', "Target user for the action; can use the format '${ columnName }' to use a data driven column name.")
						}
					}
				}
			}
		}
	}
};

const insightType: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			description: nls.localize('carbon.extension.contributes.insightType.id', "Identifier of the insight"),
			type: 'string'
		},
		contrib: insightsSchema
	}
};

export const insightsContribution: IJSONSchema = {
	description: nls.localize('carbon.extension.contributes.insights', "Contributes insights to the dashboard palette."),
	oneOf: [
		insightType,
		{
			type: 'array',
			items: insightType
		}
	]
};
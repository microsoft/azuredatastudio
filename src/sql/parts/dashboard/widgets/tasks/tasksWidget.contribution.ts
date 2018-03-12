/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { registerDashboardWidget } from 'sql/platform/dashboard/common/widgetRegistry';
import { TaskRegistry } from 'sql/platform/tasks/common/tasks';

import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { IJSONContributionRegistry, Extensions } from 'vs/platform/jsonschemas/common/jsonContributionRegistry';

const schemaRegistry = <IJSONContributionRegistry>Registry.as(Extensions.JSONContribution);

const singleTaskSchema: IJSONSchema = {
	type: 'string',
	enum: TaskRegistry.getTasks()
};

const tasksSchema: IJSONSchema = {
	type: 'array',
	items: {
		anyOf: [
			singleTaskSchema,
			{
				type: 'object',
				properties: {
					name: singleTaskSchema,
					when: {
						type: 'string'
					}
				}
			}
		]
	}
};

TaskRegistry.onTaskRegistered(e => singleTaskSchema.enum.push(e));

registerDashboardWidget('tasks-widget', '', tasksSchema);

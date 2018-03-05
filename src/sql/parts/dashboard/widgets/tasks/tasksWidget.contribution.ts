/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { registerDashboardWidget } from 'sql/platform/dashboard/common/widgetRegistry';
import { TaskRegistry } from 'sql/platform/tasks/common/tasks';

const tasksSchema: IJSONSchema = {
	type: 'array',
	items: {
		anyOf: [{
			type: 'string',
			enum: TaskRegistry.getTasks()
		},
		{
			type: 'object',
			properties: {
				name: {
					type: 'string',
					enum: TaskRegistry.getTasks()
				},
				when: {
					type: 'string'
				}
			}
		}]
	}
};

registerDashboardWidget('tasks-widget', '', tasksSchema);
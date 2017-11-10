/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { registerDashboardWidget } from 'sql/platform/dashboard/common/widgetRegistry';
import { Extensions as TaskExtensions, ITaskRegistry } from 'sql/platform/tasks/taskRegistry';
import { Registry } from 'vs/platform/registry/common/platform';

let taskRegistry = <ITaskRegistry>Registry.as(TaskExtensions.TaskContribution);

let tasksSchema: IJSONSchema = {
	type: 'object',
	properties: {
		tasks: {
			type: 'object',
			properties: taskRegistry.taskSchemas
		}
	}
};

registerDashboardWidget('tasks-widget', '', tasksSchema);
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { registerDashboardWidget } from 'sql/platform/dashboard/common/widgetRegistry';
import { TaskRegistry } from 'sql/platform/tasks/common/tasks';

let tasksSchema: IJSONSchema = {
	type: 'object',
	properties: {
		tasks: {
			type: 'object'
		}
	}
};

registerDashboardWidget('tasks-widget', '', tasksSchema);
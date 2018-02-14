/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { GlobalNewProfilerAction } from './profilerWorkbenchActions';

import { TaskRegistry } from 'sql/platform/tasks/common/tasks';
import { NewProfilerAction } from './profilerActions';

import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import * as nls from 'vs/nls';
import { IJSONSchema } from 'vs/base/common/jsonSchema';

// Contribute Global Actions
const category = nls.localize('profilerCategory', "Profiler");

const newProfilerSchema: IJSONSchema = {
	description: nls.localize('carbon.actions.newProfiler', 'Open up a new profiler window'),
	type: 'null',
	default: null
};

if (process.env['VSCODE_DEV']) {
	const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
	registry.registerWorkbenchAction(new SyncActionDescriptor(GlobalNewProfilerAction, GlobalNewProfilerAction.ID, GlobalNewProfilerAction.LABEL), 'Profiler: New Profiler', category);
	new NewProfilerAction().registerTask();
}

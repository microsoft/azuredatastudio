/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { TogglePanelAction } from 'vs/workbench/browser/panel';
import { TASKS_PANEL_ID } from 'sql/workbench/parts/taskHistory/common/tasks';
import { Action } from 'vs/base/common/actions';
import { ITaskService } from 'sql/platform/taskHistory/common/taskService';
import { TaskStatus } from 'sql/platform/connection/common/connectionManagement';
import { TaskExecutionMode } from 'sql/platform/backup/common/backupService';

export class ToggleTasksAction extends TogglePanelAction {

	public static readonly ID = 'workbench.action.tasks.toggleTasks';
	public static readonly LABEL = localize('toggleTasks', "Toggle Tasks");

	constructor(
		id: string, label: string,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IPanelService panelService: IPanelService,
	) {
		super(id, label, TASKS_PANEL_ID, panelService, layoutService);
	}
}

export class AddTestTask extends Action {
	public static readonly ID = 'workbench.action.tasks.addTestTask';
	public static readonly LABEL = localize('addTestTask', "add Test Task");

	constructor(
		id: string, label: string,
		@ITaskService private readonly taskService: ITaskService
	) {
		super(id, label);
	}

	public run(): Promise<void> {
		this.taskService.createNewTask({ name: 'test', taskId: 'test', status: TaskStatus.InProgress, serverName: 'test', databaseName: 'test', isCancelable: false, providerName: 'test', taskExecutionMode: TaskExecutionMode.execute, description: 'test' });
		return Promise.resolve();
	}
}

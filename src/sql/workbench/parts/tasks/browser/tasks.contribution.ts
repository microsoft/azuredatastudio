/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { localize } from 'vs/nls';
import { SyncActionDescriptor, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { Registry } from 'vs/platform/registry/common/platform';
import { TasksPanel } from 'sql/workbench/parts/tasks/browser/tasksPanel';
import * as lifecycle from 'vs/base/common/lifecycle';
import * as ext from 'vs/workbench/common/contributions';
import { ITaskService } from 'sql/platform/tasks/common/tasksService';
import { IActivityService, NumberBadge } from 'vs/workbench/services/activity/common/activity';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { PanelRegistry, Extensions as PanelExtensions, PanelDescriptor } from 'vs/workbench/browser/panel';
import { TASKS_PANEL_ID } from 'sql/workbench/parts/tasks/common/tasks';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { ToggleTasksAction } from 'sql/workbench/parts/tasks/browser/tasksActions';

export class StatusUpdater extends lifecycle.Disposable implements ext.IWorkbenchContribution {
	static ID = 'data.taskhistory.statusUpdater';

	private badgeHandle: lifecycle.IDisposable;

	constructor(
		@IActivityService private readonly activityBarService: IActivityService,
		@ITaskService private readonly taskService: ITaskService,
		@IPanelService private readonly panelService: IPanelService
	) {
		super();

		this._register(this.taskService.onAddNewTask(args => {
			this.panelService.openPanel(TASKS_PANEL_ID, true);
			this.onServiceChange();
		}));

		this._register(this.taskService.onTaskComplete(task => {
			this.onServiceChange();
		}));

	}

	private onServiceChange(): void {
		lifecycle.dispose(this.badgeHandle);
		let numOfInProgressTask: number = this.taskService.getNumberOfInProgressTasks();
		let badge: NumberBadge = new NumberBadge(numOfInProgressTask, n => localize('inProgressTasksChangesBadge', "{0} in progress tasks", n));
		this.badgeHandle = this.activityBarService.showActivity(TASKS_PANEL_ID, badge, 'taskhistory-viewlet-label');
	}

	public getId(): string {
		return StatusUpdater.ID;
	}

	public dispose(): void {
		lifecycle.dispose(this.badgeHandle);
		super.dispose();
	}
}

const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(
	new SyncActionDescriptor(
		ToggleTasksAction,
		ToggleTasksAction.ID,
		ToggleTasksAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyCode.KEY_T }),
	'View: Toggle Tasks',
	localize('viewCategory', "View")
);

// Register Output Panel
Registry.as<PanelRegistry>(PanelExtensions.Panels).registerPanel(new PanelDescriptor(
	TasksPanel,
	TASKS_PANEL_ID,
	localize('tasks', "Tasks"),
	'output',
	20,
	ToggleTasksAction.ID
));

// Register StatusUpdater
(<ext.IWorkbenchContributionsRegistry>Registry.as(ext.Extensions.Workbench)).registerWorkbenchContribution(StatusUpdater, LifecyclePhase.Restored);

MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
	group: '4_panels',
	command: {
		id: ToggleTasksAction.ID,
		title: localize({ key: 'miViewTasks', comment: ['&& denotes a mnemonic'] }, "&&Tasks")
	},
	order: 2
});

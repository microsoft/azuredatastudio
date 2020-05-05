/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { localize } from 'vs/nls';
import { SyncActionDescriptor, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { Registry } from 'vs/platform/registry/common/platform';
import * as lifecycle from 'vs/base/common/lifecycle';
import * as ext from 'vs/workbench/common/contributions';
import { ITaskService } from 'sql/workbench/services/tasks/common/tasksService';
import { IActivityService, NumberBadge } from 'vs/workbench/services/activity/common/activity';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { ToggleTasksAction } from 'sql/workbench/contrib/tasks/browser/tasksActions';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IViewContainersRegistry, Extensions as ViewContainerExtensions, ViewContainer, ViewContainerLocation, IViewsRegistry } from 'vs/workbench/common/views';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { TASKS_CONTAINER_ID, TASKS_VIEW_ID } from 'sql/workbench/contrib/tasks/common/tasks';
import { TaskHistoryView } from 'sql/workbench/contrib/tasks/browser/tasksView';

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
			this.panelService.openPanel(TASKS_CONTAINER_ID, true);
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
		this.badgeHandle = this.activityBarService.showViewContainerActivity(TASKS_CONTAINER_ID, { badge, clazz: 'taskhistory-viewlet-label' });
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
	SyncActionDescriptor.create(
		ToggleTasksAction,
		ToggleTasksAction.ID,
		ToggleTasksAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyCode.KEY_T }),
	'View: Toggle Tasks',
	localize('viewCategory', "View")
);

// markers view container
const VIEW_CONTAINER: ViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: TASKS_CONTAINER_ID,
	name: localize('tasks', "Tasks"),
	hideIfEmpty: true,
	order: 20,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [TASKS_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true, donotShowContainerTitleWhenMergedWithContainer: true }]),
	storageId: `${TASKS_CONTAINER_ID}.storage`,
	focusCommand: {
		id: ToggleTasksAction.ID
	}
}, ViewContainerLocation.Panel);

Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([{
	id: TASKS_VIEW_ID,
	name: localize('tasks', "Tasks"),
	canToggleVisibility: false,
	canMoveView: false,
	ctorDescriptor: new SyncDescriptor(TaskHistoryView),
}], VIEW_CONTAINER);

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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import 'vs/css!sql/media/actionBarLabel';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { localize } from 'vs/nls';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor } from 'vs/workbench/browser/viewlet';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IViewlet } from 'vs/workbench/common/viewlet';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { VIEWLET_ID, TaskHistoryViewlet } from 'sql/parts/taskHistory/viewlet/taskHistoryViewlet';
import lifecycle = require('vs/base/common/lifecycle');
import ext = require('vs/workbench/common/contributions');
import { ITaskService } from 'sql/platform/taskHistory/common/taskService';
import { IActivityService, NumberBadge } from 'vs/workbench/services/activity/common/activity';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { ToggleViewletAction } from 'vs/workbench/browser/parts/activitybar/activitybarActions';
import { IPartService } from 'vs/workbench/services/part/common/partService';

export class StatusUpdater implements ext.IWorkbenchContribution {
	static ID = 'data.taskhistory.statusUpdater';

	private badgeHandle: lifecycle.IDisposable;
	private toDispose: lifecycle.IDisposable[];

	constructor(
		@IActivityService private activityBarService: IActivityService,
		@ITaskService private _taskService: ITaskService,
		@IViewletService private _viewletService: IViewletService
	) {
		this.toDispose = [];

		this.toDispose.push(this._taskService.onAddNewTask(args => {
			this.showTasksViewlet();
			this.onServiceChange();
		}));

		this.toDispose.push(this._taskService.onTaskComplete(task => {
			this.onServiceChange();
		}));

	}

	private showTasksViewlet(): void {
		let activeViewlet: IViewlet = this._viewletService.getActiveViewlet();
		if (!activeViewlet || activeViewlet.getId() !== VIEWLET_ID) {
			this._viewletService.openViewlet(VIEWLET_ID, true);
		}
	}

	private onServiceChange(): void {
		lifecycle.dispose(this.badgeHandle);
		let numOfInProgressTask: number = this._taskService.getNumberOfInProgressTasks();
		let badge: NumberBadge = new NumberBadge(numOfInProgressTask, n => localize('inProgressTasksChangesBadge', "{0} in progress tasks", n));
		this.badgeHandle = this.activityBarService.showActivity(VIEWLET_ID, badge, 'taskhistory-viewlet-label');
	}

	public getId(): string {
		return StatusUpdater.ID;
	}

	public dispose(): void {
		this.toDispose = lifecycle.dispose(this.toDispose);
		lifecycle.dispose(this.badgeHandle);
	}
}


// Viewlet Action
export class TaskHistoryViewletAction extends ToggleViewletAction {
	public static ID = VIEWLET_ID;
	public static LABEL = nls.localize({ key: 'showTaskHistory', comment: ['Show Task History'] }, 'Show Task History');

	constructor(
		id: string,
		label: string,
		@IViewletService viewletService: IViewletService,
		@IPartService partService: IPartService
	) {
		super(viewletDescriptor, partService, viewletService);
	}
}

// Viewlet
const viewletDescriptor = new ViewletDescriptor(
	TaskHistoryViewlet,
	VIEWLET_ID,
	'Task History',
	'taskHistoryViewlet',
	1
);

Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).registerViewlet(viewletDescriptor);

// Register StatusUpdater
(<ext.IWorkbenchContributionsRegistry>Registry.as(ext.Extensions.Workbench)).registerWorkbenchContribution(StatusUpdater, LifecyclePhase.Restored);

const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(
	new SyncActionDescriptor(
		TaskHistoryViewletAction,
		TaskHistoryViewletAction.ID,
		TaskHistoryViewletAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyCode.KEY_T }),
	'View: Show Task History',
	localize('taskHistory.view', "View")
);

let configurationRegistry = <IConfigurationRegistry>Registry.as(Extensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'taskHistory',
	'title': localize('taskHistory', 'Task History'),
	'type': 'object',
	'properties': {
		'datasource.task': {
			'description': localize('datasource.task', 'Operation Task Status'),
			'type': 'array'
		}
	}
});
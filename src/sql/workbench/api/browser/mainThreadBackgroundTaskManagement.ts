/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITaskService } from 'sql/workbench/services/tasks/common/tasksService';
import { MainThreadBackgroundTaskManagementShape, SqlMainContext, ExtHostBackgroundTaskManagementShape, SqlExtHostContext } from 'sql/workbench/api/common/sqlExtHost.protocol';

import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { Disposable } from 'vs/base/common/lifecycle';


import * as azdata from 'azdata';

export enum TaskStatus {
	NotStarted = 0,
	InProgress = 1,
	Succeeded = 2,
	SucceededWithWarning = 3,
	Failed = 4,
	Canceled = 5,
	Canceling = 6
}

@extHostNamedCustomer(SqlMainContext.MainThreadBackgroundTaskManagement)
export class MainThreadBackgroundTaskManagement extends Disposable implements MainThreadBackgroundTaskManagementShape {
	private readonly _proxy: ExtHostBackgroundTaskManagementShape;

	constructor(
		context: IExtHostContext,
		@ITaskService private _taskService: ITaskService
	) {
		super();
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostBackgroundTaskManagement);
		this._register(this._taskService.onTaskComplete(task => {
			if (task.status === TaskStatus.Canceling) {
				this._proxy.$onTaskCanceled(task.id);
			}
		}));
	}

	$registerTask(taskInfo: azdata.TaskInfo): void {
		this._taskService.createNewTask(taskInfo);
		this._proxy.$onTaskRegistered(taskInfo.taskId);
	}

	$updateTask(taskProgressInfo: azdata.TaskProgressInfo): void {
		this._taskService.updateTask(taskProgressInfo);
	}
}

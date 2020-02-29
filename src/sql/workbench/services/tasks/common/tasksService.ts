/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { TaskNode } from 'sql/workbench/services/tasks/common/tasksNode';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';

export const SERVICE_ID = 'taskHistoryService';
export const ITaskService = createDecorator<ITaskService>(SERVICE_ID);

export interface ITaskService {
	_serviceBrand: undefined;
	onTaskComplete: Event<TaskNode>;
	onAddNewTask: Event<TaskNode>;
	handleNewTask(task: TaskNode): void;
	handleTaskComplete(eventArgs: TaskStatusChangeArgs): void;
	getAllTasks(): TaskNode;
	getNumberOfInProgressTasks(): number;
	onNewTaskCreated(handle: number, taskInfo: azdata.TaskInfo): void;
	createNewTask(taskInfo: azdata.TaskInfo): void;
	updateTask(taskProgressInfo: azdata.TaskProgressInfo): void;
	onTaskStatusChanged(handle: number, taskProgressInfo: azdata.TaskProgressInfo): void;
	cancelTask(providerId: string, taskId: string): Promise<boolean | undefined>;
	/**
	 * Register a ObjectExplorer provider
	 */
	registerProvider(providerId: string, provider: azdata.TaskServicesProvider): void;
}

export interface TaskStatusChangeArgs {
	taskId: string;
	status: azdata.TaskStatus;
	message?: string;
	script?: string;
}

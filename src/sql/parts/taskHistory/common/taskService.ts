/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import { TaskNode, TaskStatus, TaskExecutionMode } from 'sql/parts/taskHistory/common/taskNode';
import { IQueryEditorService } from 'sql/parts/query/common/queryEditorService';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import Event, { Emitter } from 'vs/base/common/event';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { IChoiceService } from 'vs/platform/message/common/message';
import { localize } from 'vs/nls';
import Severity from 'vs/base/common/severity';
import { TPromise } from 'vs/base/common/winjs.base';

export const SERVICE_ID = 'taskHistoryService';
export const ITaskService = createDecorator<ITaskService>(SERVICE_ID);

export interface ITaskService {
	_serviceBrand: any;
	onTaskComplete: Event<TaskNode>;
	onAddNewTask: Event<TaskNode>;
	handleNewTask(task: TaskNode): void;
	handleTaskComplete(eventArgs: TaskStatusChangeArgs): void;
	getAllTasks(): TaskNode;
	getNumberOfInProgressTasks(): number;
	onNewTaskCreated(handle: number, taskInfo: sqlops.TaskInfo);
	onTaskStatusChanged(handle: number, taskProgressInfo: sqlops.TaskProgressInfo);
	cancelTask(providerId: string, taskId: string): Thenable<boolean>;
	/**
	 * Register a ObjectExplorer provider
	 */
	registerProvider(providerId: string, provider: sqlops.TaskServicesProvider): void;
}

export interface TaskStatusChangeArgs {
	taskId: string;
	status: sqlops.TaskStatus;
	message?: string;
	script?: string;
}

export class TaskService implements ITaskService {
	public _serviceBrand: any;
	private _taskQueue: TaskNode;
	private _onTaskComplete = new Emitter<TaskNode>();
	private _onAddNewTask = new Emitter<TaskNode>();
	private _providers: { [handle: string]: sqlops.TaskServicesProvider; } = Object.create(null);

	constructor(
		@ILifecycleService lifecycleService: ILifecycleService,
		@IChoiceService private choiceService: IChoiceService,
		@IQueryEditorService private queryEditorService: IQueryEditorService
	) {
		this._taskQueue = new TaskNode('Root', undefined, undefined);
		this._onTaskComplete = new Emitter<TaskNode>();
		this._onAddNewTask = new Emitter<TaskNode>();

		lifecycleService.onWillShutdown(event => event.veto(this.beforeShutdown()));

	}

	/**
	 * Register a ObjectExplorer provider
	 */
	public registerProvider(providerId: string, provider: sqlops.TaskServicesProvider): void {
		this._providers[providerId] = provider;
	}

	public onNewTaskCreated(handle: number, taskInfo: sqlops.TaskInfo) {
		let node: TaskNode = new TaskNode(taskInfo.name, taskInfo.serverName, taskInfo.databaseName, taskInfo.taskId, taskInfo.taskExecutionMode, taskInfo.isCancelable);
		node.providerName = taskInfo.providerName;
		this.handleNewTask(node);
	}

	public onTaskStatusChanged(handle: number, taskProgressInfo: sqlops.TaskProgressInfo) {
		this.handleTaskComplete({
			taskId: taskProgressInfo.taskId,
			status: taskProgressInfo.status,
			message: taskProgressInfo.message,
			script: taskProgressInfo.script
		});
	}

	public cancelTask(providerId: string, taskId: string): Thenable<boolean> {
		let task = this.getTaskInQueue(taskId);
		task.status = TaskStatus.canceling;
		this._onTaskComplete.fire(task);
		let provider = this._providers[providerId];
		if (provider) {
			return provider.cancelTask({
				taskId: taskId
			});
		}
		return Promise.resolve(undefined);
	}

	private cancelAllTasks(): Thenable<void> {
		return new TPromise<void>((resolve, reject) => {
			let promises = this._taskQueue.children.map(task => {
				if (task.status === TaskStatus.inProgress || task.status === TaskStatus.notStarted) {
					return this.cancelTask(task.providerName, task.id);
				}
				return Promise.resolve(true);
			});

			Promise.all(promises).then(result => {
				resolve(undefined);
			}).catch(error => {
				reject(error);
			});
		});
	}

	public handleNewTask(task: TaskNode): void {
		if (this._taskQueue.hasChildren) {
			this._taskQueue.children.unshift(task);
		} else {
			this._taskQueue.hasChildren = true;
			this._taskQueue.children = [task];
		}
		this._onAddNewTask.fire(task);
	}

	public beforeShutdown(): TPromise<boolean> {
		const message = localize('InProgressWarning', '1 or more tasks are in progress. Are you sure you want to quit?');
		const options = [
			localize('yes', "Yes"),
			localize('no', "No")
		];

		return new TPromise<boolean>((resolve, reject) => {
			let numOfInprogressTasks = this.getNumberOfInProgressTasks();
			if (numOfInprogressTasks > 0) {
				this.choiceService.choose(Severity.Warning, message, options, 0, false).done(choice => {
					switch (choice) {
						case 0:
							let timeoutId: number;
							let isTimeout = false;
							this.cancelAllTasks().then(() => {
								clearTimeout(timeoutId);
								if (!isTimeout) {
									resolve(false);
								}
							}, error => {
								clearTimeout(timeoutId);
								if (!isTimeout) {
									resolve(false);
								};
							});
							timeoutId = setTimeout(function () {
								isTimeout = true;
								resolve(false);
							}, 2000);
							break;
						case 1:
							resolve(true);
					}
				});
			} else {
				resolve(false);
			}
		});
	}

	public handleTaskComplete(eventArgs: TaskStatusChangeArgs): void {
		var task = this.getTaskInQueue(eventArgs.taskId);
		if (task) {
			task.status = eventArgs.status;
			if (eventArgs.message) {
				task.message = eventArgs.message;
			}
			switch (task.status) {
				case TaskStatus.canceled:
				case TaskStatus.succeeded:
				case TaskStatus.succeededWithWarning:
				case TaskStatus.failed:
					task.endTime = new Date().toLocaleTimeString();
					task.timer.stop();
					this._onTaskComplete.fire(task);
					break;
				default:
					break;
			}

			if ((task.status === TaskStatus.succeeded || task.status === TaskStatus.succeededWithWarning)
				&& eventArgs.script && eventArgs.script !== '') {
				if (task.taskExecutionMode === TaskExecutionMode.script) {
					this.queryEditorService.newSqlEditor(eventArgs.script);
				} else if (task.taskExecutionMode === TaskExecutionMode.executeAndScript) {
					task.script = eventArgs.script;
				}
			}
		}

	}

	private getTaskInQueue(taskId: string): TaskNode {
		if (this._taskQueue.hasChildren) {
			return this._taskQueue.children.find(x => x.id === taskId);
		}
		return undefined;
	}

	public get onTaskComplete(): Event<TaskNode> {
		return this._onTaskComplete.event;
	}

	public get onAddNewTask(): Event<TaskNode> {
		return this._onAddNewTask.event;
	}

	public getNumberOfInProgressTasks(): number {
		if (this._taskQueue.hasChildren) {
			var inProgressTasks = this._taskQueue.children.filter(x => x.status === TaskStatus.inProgress);
			return inProgressTasks ? inProgressTasks.length : 0;
		}
		return 0;
	}

	public getAllTasks(): TaskNode {
		return this._taskQueue;
	}
}
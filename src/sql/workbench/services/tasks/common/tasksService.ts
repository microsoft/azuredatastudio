/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { TaskNode, TaskStatus, TaskExecutionMode } from 'sql/workbench/services/tasks/common/tasksNode';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event, Emitter } from 'vs/base/common/event';
import { ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { localize } from 'vs/nls';
import Severity from 'vs/base/common/severity';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';

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

export class TaskService implements ITaskService {
	public _serviceBrand: undefined;
	private _taskQueue: TaskNode;
	private _onTaskComplete = new Emitter<TaskNode>();
	private _onAddNewTask = new Emitter<TaskNode>();
	private _providers: { [handle: string]: azdata.TaskServicesProvider; } = Object.create(null);

	constructor(
		@ILifecycleService lifecycleService: ILifecycleService,
		@IDialogService private dialogService: IDialogService,
		@IQueryEditorService private queryEditorService: IQueryEditorService,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService
	) {
		this._taskQueue = new TaskNode('Root');
		this._onTaskComplete = new Emitter<TaskNode>();
		this._onAddNewTask = new Emitter<TaskNode>();
		lifecycleService.onBeforeShutdown(event => event.veto(this.beforeShutdown(), 'veto.taskservice'));
	}

	/**
	 * Register a ObjectExplorer provider
	 */
	public registerProvider(providerId: string, provider: azdata.TaskServicesProvider): void {
		this._providers[providerId] = provider;
	}

	public onNewTaskCreated(handle: number, taskInfo: azdata.TaskInfo) {
		this.createNewTask(taskInfo);
	}

	public createNewTask(taskInfo: azdata.TaskInfo) {
		let databaseName: string | undefined = taskInfo.databaseName;
		let serverName: string = taskInfo.serverName;
		if (taskInfo && taskInfo.connection) {
			let connectionProfile = this.connectionManagementService.getConnectionProfile(taskInfo.connection.connectionId);
			if (connectionProfile && !!databaseName) {
				databaseName = connectionProfile.databaseName;
			}
			if (connectionProfile && !!serverName) {
				serverName = connectionProfile.serverName;
			}
		}
		let node: TaskNode = new TaskNode(taskInfo.name, serverName, databaseName, taskInfo.taskId, taskInfo.taskExecutionMode, taskInfo.isCancelable, taskInfo.targetLocation);
		node.providerName = taskInfo.providerName;
		this.handleNewTask(node);
	}

	public updateTask(taskProgressInfo: azdata.TaskProgressInfo) {
		this.handleTaskComplete({
			taskId: taskProgressInfo.taskId,
			status: taskProgressInfo.status,
			message: taskProgressInfo.message,
			script: taskProgressInfo.script
		});
	}

	public onTaskStatusChanged(handle: number, taskProgressInfo: azdata.TaskProgressInfo) {
		this.updateTask(taskProgressInfo);
	}

	public cancelTask(providerId: string, taskId: string): Promise<boolean | undefined> {
		let task = this.getTaskInQueue(taskId);
		if (task) {
			task.status = TaskStatus.Canceling;
			this._onTaskComplete.fire(task);
			if (providerId) {
				let provider = this._providers[providerId];
				if (provider && provider.cancelTask) {
					return Promise.resolve(provider.cancelTask({
						taskId: taskId
					}));
				}
			} else {
				return Promise.resolve(true);
			}
		}
		return Promise.resolve(undefined);
	}

	private cancelAllTasks(): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			let promises = this._taskQueue.children!.map(task => {
				if (task.status === TaskStatus.InProgress || task.status === TaskStatus.NotStarted) {
					return this.cancelTask(task.providerName!, task.id);
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
			this._taskQueue.children!.unshift(task);
		} else {
			this._taskQueue.hasChildren = true;
			this._taskQueue.children = [task];
		}
		this._onAddNewTask.fire(task);
	}

	public beforeShutdown(): Promise<boolean> {
		const message = localize('InProgressWarning', "1 or more tasks are in progress. Are you sure you want to quit?");
		const options = [
			localize('taskService.yes', "Yes"),
			localize('taskService.no', "No")
		];

		return new Promise<boolean>((resolve, reject) => {
			let numOfInprogressTasks = this.getNumberOfInProgressTasks();
			if (numOfInprogressTasks > 0) {
				this.dialogService.show(Severity.Warning, message, options).then(choice => {
					switch (choice.choice) {
						case 0:
							let timeout: any;
							let isTimeout = false;
							this.cancelAllTasks().then(() => {
								clearTimeout(timeout);
								if (!isTimeout) {
									resolve(false);
								}
							}, error => {
								clearTimeout(timeout);
								if (!isTimeout) {
									resolve(false);
								}
							});
							timeout = setTimeout(function () {
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
		let task = this.getTaskInQueue(eventArgs.taskId);
		if (task) {
			task.status = eventArgs.status;
			if (eventArgs.message) {
				task.message = eventArgs.message;
			}
			switch (task.status) {
				case TaskStatus.Canceled:
				case TaskStatus.Succeeded:
				case TaskStatus.SucceededWithWarning:
				case TaskStatus.Failed:
					task.endTime = new Date().toLocaleTimeString();
					task.timer.stop();
					this._onTaskComplete.fire(task);
					break;
				default:
					break;
			}

			if ((task.status === TaskStatus.Succeeded || task.status === TaskStatus.SucceededWithWarning)
				&& eventArgs.script && eventArgs.script !== '') {
				if (task.taskExecutionMode === TaskExecutionMode.script) {
					this.queryEditorService.newSqlEditor({ initalContent: eventArgs.script });
				} else if (task.taskExecutionMode === TaskExecutionMode.executeAndScript) {
					task.script = eventArgs.script;
				}
			}
		}

	}

	private getTaskInQueue(taskId: string): TaskNode | undefined {
		if (this._taskQueue.hasChildren) {
			return this._taskQueue.children!.find(x => x.id === taskId);
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
			let inProgressTasks = this._taskQueue.children!.filter(x => x.status === TaskStatus.InProgress);
			return inProgressTasks ? inProgressTasks.length : 0;
		}
		return 0;
	}

	public getAllTasks(): TaskNode {
		return this._taskQueue;
	}
}

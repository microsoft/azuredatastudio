/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Mock, It, Times } from 'typemoq';
import { MainThreadBackgroundTaskManagement, TaskStatus } from 'sql/workbench/api/browser/mainThreadBackgroundTaskManagement';
import { ITaskService } from 'sql/workbench/services/tasks/common/tasksService';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { TaskNode } from 'sql/workbench/services/tasks/common/tasksNode';
import { Emitter } from 'vs/base/common/event';
import { ExtHostBackgroundTaskManagementShape } from 'sql/workbench/api/common/sqlExtHost.protocol';

suite('MainThreadBackgroundTaskManagement Tests', () => {
	let mainThreadBackgroundTaskManagement: MainThreadBackgroundTaskManagement;
	let mockProxy: Mock<ExtHostBackgroundTaskManagementShape>;
	let taskService: Mock<ITaskService>;
	let nothing: void;
	let operationId = 'operation is';
	let onTaskComplete = new Emitter<TaskNode>();
	setup(() => {
		mockProxy = Mock.ofInstance(<ExtHostBackgroundTaskManagementShape>{
			$onTaskRegistered: (operationId: string) => nothing,
			$onTaskCanceled: (operationId: string) => nothing,
			$registerTask: (operationInfo: azdata.BackgroundOperationInfo) => nothing,
			$removeTask: (operationId: string) => nothing,
		});
		taskService = Mock.ofInstance(<ITaskService>{
			_serviceBrand: undefined,
			onTaskComplete: undefined,
			onAddNewTask: undefined,
			handleNewTask: undefined,
			handleTaskComplete: undefined,
			getAllTasks: undefined,
			getNumberOfInProgressTasks: undefined,
			onNewTaskCreated: undefined,
			createNewTask: (taskInfo: azdata.TaskInfo) => nothing,
			updateTask: (taskProgressInfo: azdata.TaskProgressInfo) => nothing,
			onTaskStatusChanged: undefined,
			cancelTask: undefined,
			registerProvider: undefined
		});
		let mainContext = <IExtHostContext>{
			getProxy: proxyType => mockProxy.object
		};

		taskService.setup(x => x.onTaskComplete).returns(() => onTaskComplete.event);

		mainThreadBackgroundTaskManagement = new MainThreadBackgroundTaskManagement(mainContext, taskService.object);
	});

	test('RegisterTask should successfully create background task', () => {
		let taskInfo: azdata.TaskInfo = {
			taskId: operationId,
			databaseName: undefined,
			description: undefined,
			isCancelable: true,
			name: 'task name',
			providerName: undefined,
			serverName: undefined,
			status: TaskStatus.NotStarted,
			taskExecutionMode: 0
		};
		mainThreadBackgroundTaskManagement.$registerTask(taskInfo);
		taskService.verify(x => x.createNewTask(It.is(t => t.status === TaskStatus.NotStarted)), Times.once());
		mockProxy.verify(x => x.$onTaskRegistered(operationId), Times.once());
	});

	test('UpdateTask should successfully update the background task status', () => {
		let taskInfo: azdata.TaskProgressInfo = {
			taskId: operationId,
			status: TaskStatus.InProgress,
			message: undefined,
		};
		mainThreadBackgroundTaskManagement.$updateTask(taskInfo);
		taskService.verify(x => x.updateTask(It.is(t => t.status === TaskStatus.InProgress)), Times.once());
	});

	test('Canceling the task should notify the proxy', () => {
		let taskInfo: azdata.TaskProgressInfo = {
			taskId: operationId,
			status: TaskStatus.InProgress,
			message: undefined,
		};
		let taskNode = new TaskNode('', '', '', operationId, undefined);
		taskNode.status = TaskStatus.Canceling;

		onTaskComplete.fire(taskNode);
		mainThreadBackgroundTaskManagement.$updateTask(taskInfo);
		mockProxy.verify(x => x.$onTaskCanceled(It.is(t => t === operationId)), Times.once());
	});

});

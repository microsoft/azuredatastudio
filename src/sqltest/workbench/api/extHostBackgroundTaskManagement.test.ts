/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as assert from 'assert';
import { Mock, It, Times } from 'typemoq';
import { ExtHostBackgroundTaskManagement, TaskStatus } from 'sql/workbench/api/node/extHostBackgroundTaskManagement';
import { MainThreadBackgroundTaskManagementShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';


suite('ExtHostBackgroundTaskManagement Tests', () => {
	let extHostBackgroundTaskManagement: ExtHostBackgroundTaskManagement;
	let mockProxy: Mock<MainThreadBackgroundTaskManagementShape>;
	let nothing: void;
	let operationId = 'operation is';
	setup(() => {
		mockProxy = Mock.ofInstance(<MainThreadBackgroundTaskManagementShape>{

			$registerTask: (taskInfo: sqlops.TaskInfo) => nothing,
			$updateTask: (taskProgressInfo: sqlops.TaskProgressInfo) => nothing
		});
		let mainContext = <IMainContext>{
			getProxy: proxyType => mockProxy.object
		};

		mockProxy.setup(x => x.$registerTask(It.isAny())).callback(() => {
			extHostBackgroundTaskManagement.$onTaskRegistered(operationId);
		});
		extHostBackgroundTaskManagement = new ExtHostBackgroundTaskManagement(mainContext);
	});

	test('RegisterTask should successfully create background task and update status', () => {
		let operationInfo: sqlops.BackgroundOperationInfo = {
			connection: undefined,
			description: 'description',
			displayName: 'displayName',
			isCancelable: true,
			operation: (op: sqlops.BackgroundOperation) => { op.updateStatus(TaskStatus.Succeeded); },
			operationId: operationId
		};
		extHostBackgroundTaskManagement.$registerTask(operationInfo);
		mockProxy.verify(x => x.$registerTask(It.is(
			t => t.name === operationInfo.displayName &&
				t.description === operationInfo.description &&
				t.taskId === operationId &&
				t.isCancelable === operationInfo.isCancelable &&
				t.providerName === undefined
		)), Times.once());
		mockProxy.verify(x => x.$updateTask(It.is(t => t.status === TaskStatus.Succeeded)), Times.once());
		extHostBackgroundTaskManagement.$removeTask(operationId);
	});

	test('Canceling the task should notify the extension', () => {
		let operationInfo: sqlops.BackgroundOperationInfo = {
			connection: undefined,
			description: 'description',
			displayName: 'displayName',
			isCancelable: true,
			operation: (op: sqlops.BackgroundOperation) => {
				op.onCanceled(() => {
					op.updateStatus(TaskStatus.Canceled);
				});
			},
			operationId: operationId
		};
		extHostBackgroundTaskManagement.$registerTask(operationInfo);
		extHostBackgroundTaskManagement.$onTaskCanceled(operationId);

		mockProxy.verify(x => x.$updateTask(It.is(t => t.status === TaskStatus.Canceled)), Times.once());
		extHostBackgroundTaskManagement.$removeTask(operationId);
	});

	test('RegisterTask should assign unique id to the operation is not assigned', () => {
		let operationInfo: sqlops.BackgroundOperationInfo = {
			connection: undefined,
			description: 'description',
			displayName: 'displayName',
			isCancelable: true,
			operation: (op: sqlops.BackgroundOperation) => { op.updateStatus(TaskStatus.Succeeded); },
			operationId: undefined
		};
		extHostBackgroundTaskManagement.$registerTask(operationInfo);
		mockProxy.verify(x => x.$registerTask(It.is(t => t.taskId !== undefined)), Times.once());

		extHostBackgroundTaskManagement.$removeTask(operationId);
	});

	test('RegisterTask should fail given id of an existing operation', () => {
		let operationInfo: sqlops.BackgroundOperationInfo = {
			connection: undefined,
			description: 'description',
			displayName: 'displayName',
			isCancelable: true,
			operation: (op: sqlops.BackgroundOperation) => { op.updateStatus(TaskStatus.Succeeded); },
			operationId: operationId
		};
		extHostBackgroundTaskManagement.$registerTask(operationInfo);
		mockProxy.verify(x => x.$registerTask(It.is(t => t.taskId === operationId)), Times.once());
		assert.throws(() => extHostBackgroundTaskManagement.$registerTask(operationInfo));

		extHostBackgroundTaskManagement.$removeTask(operationId);
	});
});
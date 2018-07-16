/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { ExtHostBackgroundTaskManagementShape, SqlMainContext, MainThreadBackgroundTaskManagementShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { Emitter } from 'vs/base/common/event';

export enum TaskStatus {
	NotStarted = 0,
	InProgress = 1,
	Succeeded = 2,
	SucceededWithWarning = 3,
	Failed = 4,
	Canceled = 5,
	Canceling = 6
}

export class ExtBackgroundOperation implements sqlops.BackgroundOperation {
	private readonly _proxy: MainThreadBackgroundTaskManagementShape;
	private _onCanceled = new Emitter<void>();

	constructor(
		private _id: string,
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadBackgroundTaskManagement);
	}

	public updateStatus(status: TaskStatus, message?: string): void {
		this._proxy.$updateTask({
			message: message,
			status: status,
			taskId: this.id
		});
	}

	public get onCanceled(): vscode.Event<void> {
		return this._onCanceled.event;
	}

	public cancel(): void {
		this._onCanceled.fire();
	}

	public get id(): string {
		return this._id;
	}
}

export class ExtHostBackgroundTaskManagement implements ExtHostBackgroundTaskManagementShape {
	private readonly _proxy: MainThreadBackgroundTaskManagementShape;
	private readonly _handlers = new Map<string, (view: sqlops.BackgroundOperation) => void>();
	private readonly _operations = new Map<string, ExtBackgroundOperation>();
	private readonly _mainContext: IMainContext;

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadBackgroundTaskManagement);
		this._mainContext = mainContext;
	}

	$onTaskRegistered(taskId: string, taskInfo: sqlops.TaskInfo): void {
		let operationInfo = new ExtBackgroundOperation(taskId, this._mainContext);
		this._operations.set(taskId, operationInfo);
		let handler = this._handlers.get(taskId);
		if (handler) {
			handler(operationInfo);
		}
	}

	$onTaskCanceled(taskId: string): void {
		let operation = this._operations.get(taskId);
		if (operation) {
			operation.cancel();
		}
	}

	$registerTask(taskId: string, operationInfo: sqlops.BackgroundOperationInfo, handler: (task: sqlops.BackgroundOperation) => void): void {
		this._handlers.set(taskId, handler);
		let taskInfo: sqlops.TaskInfo = {
			databaseName: operationInfo.connectionInfo && operationInfo.connectionInfo.databaseName,
			serverName: operationInfo.connectionInfo && operationInfo.connectionInfo.serverName,
			description: operationInfo.description,
			isCancelable: operationInfo.isCancelable,
			name: operationInfo.displayName,
			providerName: undefined,
			taskExecutionMode: 0,
			taskId: taskId,
			status: TaskStatus.NotStarted
		};
		this._proxy.$registerTask(taskInfo);
	}
}
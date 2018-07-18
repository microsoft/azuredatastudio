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
import { generateUuid } from 'vs/base/common/uuid';

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
	private readonly _handlers = new Map<string, sqlops.BackgroundOperationInfo>();
	private readonly _operations = new Map<string, ExtBackgroundOperation>();
	private readonly _mainContext: IMainContext;

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadBackgroundTaskManagement);
		this._mainContext = mainContext;
	}

	$onTaskRegistered(operationId: string): void {
		let extOperationInfo = new ExtBackgroundOperation(operationId, this._mainContext);
		this._operations.set(operationId, extOperationInfo);
		let operationInfo = this._handlers.get(operationId);
		if (operationInfo) {
			operationInfo.operation(extOperationInfo);
		}
	}

	$onTaskCanceled(operationId: string): void {
		let operation = this._operations.get(operationId);
		if (operation) {
			operation.cancel();
		}
	}

	$registerTask(operationInfo: sqlops.BackgroundOperationInfo): void {
		let operationId = operationInfo.operationId || `OperationId${generateUuid()}`;
		if (this._handlers.has(operationId)) {
			throw new Error(`operation '${operationId}' already exists`);
		}

		this._handlers.set(operationId, operationInfo);
		let taskInfo: sqlops.TaskInfo = {
			databaseName: undefined,
			serverName: undefined,
			description: operationInfo.description,
			isCancelable: operationInfo.isCancelable,
			name: operationInfo.displayName,
			providerName: undefined, //setting provider name will cause the task to be processed by the provider. But this task is created in the extension and needs to be handled
			//by the extension
			taskExecutionMode: 0,
			taskId: operationId,
			status: TaskStatus.NotStarted,
			connection: operationInfo.connection
		};
		this._proxy.$registerTask(taskInfo);
	}

	$removeTask(operationId: string) {
		if (this._handlers.has(operationId)) {
			this._handlers.delete(operationId);
		}
	}
}
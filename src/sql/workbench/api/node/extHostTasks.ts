/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ILogService } from 'vs/platform/log/common/log';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import * as extHostTypes from 'vs/workbench/api/node/extHostTypes';
import { TPromise } from 'vs/base/common/winjs.base';

import { ITaskHandlerDescription } from 'sql/platform/tasks/common/tasks';
import { SqlMainContext, MainThreadTasksShape, ExtHostTasksShape } from 'sql/workbench/api/node/sqlExtHost.protocol';

interface TaskHandler {
	callback: Function;
	thisArg: any;
	description: ITaskHandlerDescription;
}

export class ExtHostTasks implements ExtHostTasksShape {
	private _proxy: MainThreadTasksShape;
	private _commands = new Map<string, TaskHandler>();

	constructor(
		mainContext: IMainContext,
		private logService: ILogService
	) {
		this._proxy = mainContext.get(SqlMainContext.MainThreadTasks);
	}

	registerTask(id: string, callback: <T>(...args: any[]) => T | Thenable<T>, thisArg?: any, description?: ITaskHandlerDescription): extHostTypes.Disposable {
		this.logService.trace('ExtHostCommands#registerCommand', id);

		if (!id.trim().length) {
			throw new Error('invalid id');
		}

		if (this._commands.has(id)) {
			throw new Error(`command '${id}' already exists`);
		}

		this._commands.set(id, { callback, thisArg, description });
		this._proxy.$registerTask(id);

		return new extHostTypes.Disposable(() => {
			if (this._commands.delete(id)) {
				this._proxy.$unregisterTask(id);
			}
		});
	}

	$executeContributedTask<T>(id: string, ...args: any[]): Thenable<T> {
		throw new Error("Method not implemented.");
	}

	$getContributedTaskHandlerDescriptions(): TPromise<{ [id: string]: any; }> {
		throw new Error("Method not implemented.");
	}
}

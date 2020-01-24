/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { validateConstraint } from 'vs/base/common/types';
import { ILogService } from 'vs/platform/log/common/log';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import * as extHostTypes from 'vs/workbench/api/common/extHostTypes';

import * as azdata from 'azdata';

import { ITaskHandlerDescription } from 'sql/workbench/services/tasks/common/tasks';
import { SqlMainContext, MainThreadTasksShape, ExtHostTasksShape } from 'sql/workbench/api/common/sqlExtHost.protocol';

interface TaskHandler {
	callback: Function;
	thisArg: any;
	description: ITaskHandlerDescription;
}

export class ExtHostTasks implements ExtHostTasksShape {
	private _proxy: MainThreadTasksShape;
	private _tasks = new Map<string, TaskHandler>();

	constructor(
		mainContext: IMainContext,
		private logService: ILogService
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadTasks);
	}

	registerTask(id: string, callback: azdata.tasks.ITaskHandler, thisArg?: any, description?: ITaskHandlerDescription): extHostTypes.Disposable {
		this.logService.trace('ExtHostTasks#registerTask', id);

		if (!id.trim().length) {
			throw new Error('invalid id');
		}

		if (this._tasks.has(id)) {
			throw new Error(`task '${id}' already exists`);
		}

		this._tasks.set(id, { callback, thisArg, description });
		this._proxy.$registerTask(id);

		return new extHostTypes.Disposable(() => {
			if (this._tasks.delete(id)) {
				this._proxy.$unregisterTask(id);
			}
		});
	}

	$executeContributedTask<T>(id: string, ...args: any[]): Thenable<T> {
		let command = this._tasks.get(id);
		if (!command) {
			return Promise.reject(new Error(`Contributed task '${id}' does not exist.`));
		}

		let { callback, thisArg, description } = command;

		if (description) {
			for (let i = 0; i < description.args.length; i++) {
				try {
					validateConstraint(args[i], description.args[i].constraint);
				} catch (err) {
					return Promise.reject(new Error(`Running the contributed task:'${id}' failed. Illegal argument '${description.args[i].name}' - ${description.args[i].description}`));
				}
			}
		}

		try {
			let result = callback.apply(thisArg, args);
			return Promise.resolve(result);
		} catch (err) {
			return Promise.reject(new Error(`Running the contributed task:'${id}' failed.`));
		}
	}

	$getContributedTaskHandlerDescriptions(): Promise<{ [id: string]: any; }> {
		throw new Error('Method not implemented.');
	}
}

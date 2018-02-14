/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { validateConstraint } from 'vs/base/common/types';
import { ILogService } from 'vs/platform/log/common/log';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import * as extHostTypes from 'vs/workbench/api/node/extHostTypes';
import { TPromise } from 'vs/base/common/winjs.base';

import { ITaskHandlerDescription } from 'sql/platform/tasks/common/tasks';
import { SqlMainContext, MainThreadTasksShape, ExtHostTasksShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { ArgumentProcessor } from 'vs/workbench/api/node/extHostCommands';

interface TaskHandler {
	callback: Function;
	thisArg: any;
	description: ITaskHandlerDescription;
}

export class ExtHostTasks implements ExtHostTasksShape {
	private _proxy: MainThreadTasksShape;
	private _tasks = new Map<string, TaskHandler>();
	private _argumentProcessors: ArgumentProcessor[] = [];

	constructor(
		mainContext: IMainContext,
		private logService: ILogService
	) {
		this._proxy = mainContext.get(SqlMainContext.MainThreadTasks);
	}

	registerArgumentProcessor(processor: ArgumentProcessor): void {
		this._argumentProcessors.push(processor);
	}

	registerTask(id: string, callback: <T>(...args: any[]) => T | Thenable<T>, thisArg?: any, description?: ITaskHandlerDescription): extHostTypes.Disposable {
		this.logService.trace('ExtHostCommands#registerCommand', id);

		if (!id.trim().length) {
			throw new Error('invalid id');
		}

		if (this._tasks.has(id)) {
			throw new Error(`command '${id}' already exists`);
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
			return TPromise.wrapError<T>(new Error(`Contributed command '${id}' does not exist.`));
		}

		let { callback, thisArg, description } = command;

		if (description) {
			for (let i = 0; i < description.args.length; i++) {
				try {
					validateConstraint(args[i], description.args[i].constraint);
				} catch (err) {
					return TPromise.wrapError<T>(new Error(`Running the contributed command:'${id}' failed. Illegal argument '${description.args[i].name}' - ${description.args[i].description}`));
				}
			}
		}

		args = args.map(arg => this._argumentProcessors.reduce((r, p) => p.processArgument(r), arg));

		try {
			let result = callback.apply(thisArg, args);
			return TPromise.as(result);
		} catch (err) {
			// console.log(err);
			// try {
			// 	console.log(toErrorMessage(err));
			// } catch (err) {
			// 	//
			// }
			return TPromise.wrapError<T>(new Error(`Running the contributed command:'${id}' failed.`));
		}
	}

	$getContributedTaskHandlerDescriptions(): TPromise<{ [id: string]: any; }> {
		throw new Error("Method not implemented.");
	}
}

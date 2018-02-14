/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { TaskRegistry, ITaskHandlerDescription, ITaskService } from 'sql/platform/tasks/common/tasks';
import { IDisposable } from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';

import {
	ExtHostAccountManagementShape,
	MainThreadAccountManagementShape,
	SqlExtHostContext,
	SqlMainContext,
	ExtHostTasksShape,
	MainThreadTasksShape
} from 'sql/workbench/api/node/sqlExtHost.protocol';

@extHostNamedCustomer(SqlMainContext.MainThreadTasks)
export class MainThreadTasks implements MainThreadTasksShape {

	private readonly _disposables = new Map<string, IDisposable>();
	private readonly _generateCommandsDocumentationRegistration: IDisposable;
	private readonly _proxy: ExtHostTasksShape;

	constructor(
		extHostContext: IExtHostContext,
		@ITaskService private readonly _commandService: ITaskService,
	) {
		this._proxy = extHostContext.get(SqlExtHostContext.ExtHostTasks);

		this._generateCommandsDocumentationRegistration = TaskRegistry.registerTask('_generateCommandsDocumentation', () => this._generateCommandsDocumentation());
	}

	dispose() {
		this._disposables.forEach(value => value.dispose());
		this._disposables.clear();

		this._generateCommandsDocumentationRegistration.dispose();
	}

	private _generateCommandsDocumentation(): TPromise<void> {
		return this._proxy.$getContributedTaskHandlerDescriptions().then(result => {
			// add local commands
			const commands = TaskRegistry.getTasks();
			for (let id in commands) {
				let { description } = commands[id];
				if (description) {
					result[id] = description;
				}
			}

			// print all as markdown
			const all: string[] = [];
			for (let id in result) {
				all.push('`' + id + '` - ' + _generateMarkdown(result[id]));
			}
			console.log(all.join('\n'));
		});
	}

	$registerTask(id: string): TPromise<any> {
		this._disposables.set(
			id,
			TaskRegistry.registerTask(id, (accessor, ...args) => this._proxy.$executeContributedTask(id, ...args))
		);
		return undefined;
	}

	$unregisterTask(id: string): TPromise<any> {
		if (this._disposables.has(id)) {
			this._disposables.get(id).dispose();
			this._disposables.delete(id);
		}
		return undefined;
	}

	$executeTask<T>(id: string, profile: any, args: any[]): Thenable<T> {
		return this._commandService.executeTask<T>(id, profile, ...args);
	}

	$getTasks(): Thenable<string[]> {
		return TPromise.as(Object.keys(TaskRegistry.getTasks()));
	}
}

// --- command doc

function _generateMarkdown(description: string | ITaskHandlerDescription): string {
	if (typeof description === 'string') {
		return description;
	} else {
		let parts = [description.description];
		parts.push('\n\n');
		if (description.args) {
			for (let arg of description.args) {
				parts.push(`* _${arg.name}_ ${arg.description || ''}\n`);
			}
		}
		if (description.returns) {
			parts.push(`* _(returns)_ ${description.returns}`);
		}
		parts.push('\n\n');
		return parts.join('');
	}
}

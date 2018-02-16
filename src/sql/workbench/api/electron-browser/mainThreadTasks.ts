/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { TaskRegistry, ITaskHandlerDescription } from 'sql/platform/tasks/common/tasks';
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
		extHostContext: IExtHostContext
	) {
		this._proxy = extHostContext.get(SqlExtHostContext.ExtHostTasks);
	}

	dispose() {
		this._disposables.forEach(value => value.dispose());
		this._disposables.clear();

		this._generateCommandsDocumentationRegistration.dispose();
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

	// $executeTask<T>(id: string, args: any[]): Thenable<T> {
	// 	return this._commandService.executeTask<T>(id, ...args);
	// }

	$getTasks(): Thenable<string[]> {
		return TPromise.as(Object.keys(TaskRegistry.getTasks()));
	}
}

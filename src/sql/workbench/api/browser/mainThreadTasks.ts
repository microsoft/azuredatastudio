/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from 'vs/base/common/lifecycle';

import {
	ExtHostTasksShape,
	MainThreadTasksShape
} from 'sql/workbench/api/common/sqlExtHost.protocol';

import { IConnectionProfile } from 'azdata';

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TaskRegistry } from 'sql/workbench/services/tasks/browser/tasksRegistry';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { SqlExtHostContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

@extHostNamedCustomer(SqlMainContext.MainThreadTasks)
export class MainThreadTasks extends Disposable implements MainThreadTasksShape {

	private readonly _disposables = new Map<string, IDisposable>();
	private readonly _proxy: ExtHostTasksShape;

	constructor(
		extHostContext: IExtHostContext
	) {
		super();
		this._proxy = <ExtHostTasksShape><unknown>extHostContext.getProxy(SqlExtHostContext.ExtHostTasks);
	}

	override dispose() {
		this._disposables.forEach(value => value.dispose());
		this._disposables.clear();
	}

	$registerTask(id: string): Promise<any> {
		this._disposables.set(
			id,
			TaskRegistry.registerTask(id, (accessor, profile: IConnectionProfile, ...args) => {
				if (profile instanceof ConnectionProfile) {
					profile = profile.toIConnectionProfile();
				}
				this._proxy.$executeContributedTask(id, profile, ...args);
			})
		);
		return undefined;
	}

	$unregisterTask(id: string): Promise<any> {
		if (this._disposables.has(id)) {
			this._disposables.get(id).dispose();
			this._disposables.delete(id);
		}
		return undefined;
	}
}

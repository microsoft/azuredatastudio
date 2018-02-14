/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TaskRegistry, ITaskService, ITaskEvent } from 'sql/platform/tasks/common/tasks';
import { IExtensionService } from 'vs/platform/extensions/common/extensions';
import Event, { Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILogService } from 'vs/platform/log/common/log';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';

import * as data from 'data';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';

export class TaskService extends Disposable implements ITaskService {

	_serviceBrand: any;

	private _extensionHostIsReady: boolean = false;

	private _onWillExecuteTask: Emitter<ITaskEvent> = this._register(new Emitter<ITaskEvent>());
	public readonly onWillExecuteTask: Event<ITaskEvent> = this._onWillExecuteTask.event;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IExtensionService private _extensionService: IExtensionService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@ILogService private _logService: ILogService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super();
		this._extensionService.whenInstalledExtensionsRegistered().then(value => this._extensionHostIsReady = value);
	}

	executeTask<T>(id: string, connection: data.connection.Connection, serverInfo: data.ServerInfo, ...args: any[]): TPromise<T> {
		this._logService.trace('CommandService#executeCommand', id);

		// we always send an activation event, but
		// we don't wait for it when the extension
		// host didn't yet start and the command is already registered

		const activation = this._extensionService.activateByEvent(`onCommand:${id}`);

		if (!this._extensionHostIsReady && TaskRegistry.getTask(id)) {
			return this._tryExecuteTask(id, connection, serverInfo, args);
		} else {
			return activation.then(_ => this._tryExecuteTask(id, connection, serverInfo, args));
		}
	}

	private _tryExecuteTask(id: string, connection: data.connection.Connection, serverInfo: data.ServerInfo, args: any[]): TPromise<any> {
		const command = TaskRegistry.getTask(id);
		if (!command) {
			return TPromise.wrapError(new Error(`command '${id}' not found`));
		}


		// if (command.precondition && !this._contextKeyService.contextMatchesRules(command.precondition)) {
		// 	// not enabled
		// 	return TPromise.wrapError(new Error('NOT_ENABLED'));
		// }

		try {
			this._onWillExecuteTask.fire({ taskId: id });
			const result = this._instantiationService.invokeFunction.apply(this._instantiationService, [command.handler].concat([<any>connection, <any>serverInfo]).concat(args));
			return TPromise.as(result);
		} catch (err) {
			return TPromise.wrapError(err);
		}
	}
}

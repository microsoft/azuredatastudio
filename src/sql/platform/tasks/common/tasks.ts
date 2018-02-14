/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TypeConstraint, validateConstraints } from 'vs/base/common/types';
import { TPromise } from 'vs/base/common/winjs.base';
import * as platform from 'vs/platform/registry/common/platform';
import { IJSONSchema, IJSONSchemaMap } from 'vs/base/common/jsonSchema';
import { Action } from 'vs/base/common/actions';
import { IConstructorSignature3, ServicesAccessor, createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as nls from 'vs/nls';
import { ILocalizedString } from 'vs/platform/actions/common/actions';
import Event from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';

export const ITaskService = createDecorator<ITaskService>('taskService');

export interface ITaskHandlerDescription {
	description: string;
	args: { name: string; description?: string; constraint?: TypeConstraint; }[];
	returns?: string;
}

export interface ITaskEvent {
	taskId: string;
}

export interface ITasksMap {
	[id: string]: ITask;
}

export interface ITaskAction {
	id: string;
	title: string | ILocalizedString;
	category?: string | ILocalizedString;
	iconClass?: string;
	iconPath?: string;
}

export interface ITaskService {
	_serviceBrand: any;
	onWillExecuteCommand: Event<ITaskEvent>;
	executeCommand<T = any>(commandId: string, ...args: any[]): TPromise<T>;
}

export interface ITaskHandler {
	(accessor: ServicesAccessor, ...args: any[]): void;
}

export interface ITask {
	id: string;
	handler: ITaskHandler;
	// precondition?: ContextKeyExpr;
	description?: ITaskHandlerDescription;
}

export interface ITaskRegistry {
	registerTask(id: string, command: ITaskHandler): IDisposable;
	registerTask(command: ITask): IDisposable;
	addTask(userCommand: ITaskAction): boolean;
	getTask(id: string): ITask;
	getTasks(): ITasksMap;
}

export const TaskRegistry: ITaskRegistry = new class implements ITaskRegistry {

	registerTask(idOrCommand: string | ITask, handler?: ITaskHandler): IDisposable {
		return undefined;
	}

	addTask(userCommand: ITaskAction): boolean {
		return undefined;
	}

	getTask(id: string): ITask {
		return undefined;
	}

	getTasks(): ITasksMap {
		return undefined;
	}
};

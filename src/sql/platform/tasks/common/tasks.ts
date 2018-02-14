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
	commandId: string;
}

export type TaskIdentifier = string;

export interface ActionICtor extends IConstructorSignature3<string, string, string, TaskAction> {
	ID: string;
	LABEL: string;
	ICON: string;
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

export class TaskAction extends Action {
	constructor(id: string, label: string, private _icon: string) {
		super(id, label);
	}

	get icon(): string {
		return this._icon;
	}
}

export const Extensions = {
	TaskContribution: 'workbench.contributions.tasks'
};

export interface ITaskHandler {
	(accessor: ServicesAccessor, ...args: any[]): void;
}

export interface ITask {
	id: string;
	handler: ITaskHandler;
	precondition?: ContextKeyExpr;
	description?: ITaskHandlerDescription;
}

export interface ITaskRegistry {
	/**
	 * Returns a map of action ids to their contructors;
	 */
	idToCtorMap: { [id: string]: ActionICtor };

	/**
	 * Returns array of registered ids
	 */
	ids: Array<string>;

	/**
	 * Schemas of the tasks registered
	 */
	taskSchemas: IJSONSchemaMap;

	/**
	 * Registers a task very the contribution, requires later provider registration
	 * @param userTask task to add
	 */
	registerTask(id: string, command: ITaskHandler): IDisposable;
	registerTask(command: ITask): IDisposable;

	addTask(userCommand: ITaskAction): boolean;
}

export const TaskRegistry: ITaskRegistry = new class implements ITaskRegistry {
	private _idCtorMap: { [id: string]: ActionICtor } = {};
	private _taskSchema: IJSONSchema = { type: 'object', description: nls.localize('schema.taskSchema', 'Task actions specific for sql'), properties: {}, additionalProperties: false };

	get idToCtorMap(): { [id: string]: ActionICtor } {
		return this._idCtorMap;
	}

	get ids(): Array<string> {
		return Object.keys(this._idCtorMap);
	}

	get taskSchemas(): IJSONSchemaMap {
		return this._taskSchema.properties;
	}

	registerTask(idOrCommand: string | ITask, handler?: ITaskHandler): IDisposable {
		// this._idCtorMap[id] = ctor;
		// this._taskSchema.properties[id] = schema;
		// return id;
		return undefined;
	}

	addTask(userCommand: ITaskAction): boolean {
		return undefined;
	}
};

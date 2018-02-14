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
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';

export const ITaskService = createDecorator<ITaskService>('taskService');

export interface ITaskOptions {
	id: string;
	title: string;
	// precondition: ContextKeyExpr;
	iconClass: string;
	// kbOpts?: ICommandKeybindingsOptions;
	description?: ITaskHandlerDescription;
}

export abstract class Task {
	public readonly id: string;
	public readonly title: string;
	public readonly iconClass: string;
	// public readonly precondition: ContextKeyExpr;
	// private readonly _kbOpts: ITaskKeybindingsOptions;
	private readonly _description: ITaskHandlerDescription;

	constructor(opts: ITaskOptions) {
		this.id = opts.id;
		this.title = opts.title;
		this.iconClass = opts.iconClass;
		// this.precondition = opts.precondition;
		// this._kbOpts = opts.kbOpts;
		this._description = opts.description;
	}

	private toITask(/*defaultWeight: number*/): ITask {
		// const kbOpts = this._kbOpts || { primary: 0 };

		// let kbWhen = kbOpts.kbExpr;
		// if (this.precondition) {
		// 	if (kbWhen) {
		// 		kbWhen = ContextKeyExpr.and(kbWhen, this.precondition);
		// 	} else {
		// 		kbWhen = this.precondition;
		// 	}
		// }

		// const weight = (typeof kbOpts.weight === 'number' ? kbOpts.weight : defaultWeight);

		return {
			id: this.id,
			handler: (accessor, profile, args) => this.runTask(accessor, profile, args),
			// weight: weight,
			// when: kbWhen,
			// primary: kbOpts.primary,
			// secondary: kbOpts.secondary,
			// win: kbOpts.win,
			// linux: kbOpts.linux,
			// mac: kbOpts.mac,
			description: this._description
		};
	}

	public registerTask(): IDisposable {
		TaskRegistry.addTask({
			id: this.id,
			title: this.title,
			iconClass: this.iconClass
		});

		return TaskRegistry.registerTask(this.toITask());
	}

	public abstract runTask(accessor: ServicesAccessor, profile: IConnectionProfile, args: any): void | TPromise<void>;
}

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

export interface ITasksActionMap {
	[id: string]: ITaskAction;
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
	onWillExecuteTask: Event<ITaskEvent>;
	executeTask<T = any>(commandId: string, profile: IConnectionProfile, ...args: any[]): TPromise<T>;
}

export interface ITaskHandler {
	(accessor: ServicesAccessor, profile: IConnectionProfile, ...args: any[]): void;
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
	getDisplayTasks(): ITasksActionMap;
	getDisplayTask(id: string): ITaskAction;
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

	getDisplayTask(id: string): ITaskAction {
		return undefined;
	}

	getDisplayTasks(): ITasksActionMap {
		return undefined;
	}
};

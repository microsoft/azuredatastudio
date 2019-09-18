/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MenuRegistry, ICommandAction } from 'vs/platform/actions/common/actions';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ITaskRegistry, ITaskHandler, ITask, ITaskHandlerDescription, ITaskOptions } from 'sql/platform/tasks/common/tasks';
import * as types from 'vs/base/common/types';
import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { createCSSRule } from 'vs/base/browser/dom';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IdGenerator } from 'vs/base/common/idGenerator';

const ids = new IdGenerator('task-icon-');

export const TaskRegistry: ITaskRegistry = new class implements ITaskRegistry {

	private _tasks = new Array<string>();
	private _onTaskRegistered = new Emitter<string>();
	public readonly onTaskRegistered: Event<string> = this._onTaskRegistered.event;
	private taskIdToIconClassNameMap: Map<string /* task id */, string /* CSS rule */> = new Map<string, string>();

	registerTask(idOrTask: string | ITask, handler?: ITaskHandler): IDisposable {
		let disposable: IDisposable;
		let id: string;
		if (types.isString(idOrTask)) {
			disposable = CommandsRegistry.registerCommand(idOrTask, handler!);
			id = idOrTask;
		} else {
			if (idOrTask.iconClass) {
				this.taskIdToIconClassNameMap.set(idOrTask.id, idOrTask.iconClass);
			}
			disposable = CommandsRegistry.registerCommand(idOrTask);
			id = idOrTask.id;
		}

		this._tasks.push(id);
		this._onTaskRegistered.fire(id);

		return {
			dispose: () => {
				let index = this._tasks.indexOf(id);
				if (index >= 0) {
					this._tasks = this._tasks.splice(index, 1);
				}
				disposable.dispose();
			}
		};
	}

	getOrCreateTaskIconClassName(item: ICommandAction): string | undefined {
		let iconClass: string | undefined;
		if (this.taskIdToIconClassNameMap.has(item.id)) {
			iconClass = this.taskIdToIconClassNameMap.get(item.id);
		} else if (item.iconLocation) {
			iconClass = ids.nextId();
			createCSSRule(`.icon.${iconClass}`, `background-image: url("${(item.iconLocation.light || item.iconLocation.dark).toString()}")`);
			createCSSRule(`.vs-dark .icon.${iconClass}, .hc-black .icon.${iconClass}`, `background-image: url("${(item.iconLocation.dark).toString()}")`);
			this.taskIdToIconClassNameMap.set(item.id, iconClass);
		}
		return iconClass;
	}

	getTasks(): string[] {
		return this._tasks.slice(0);
	}
};

export abstract class Task {
	public readonly id: string;
	public readonly title: string;
	public readonly iconPathDark: string;
	public readonly iconPath?: { dark: URI; light?: URI; };
	private readonly _iconClass?: string;
	private readonly _description?: ITaskHandlerDescription;

	constructor(private opts: ITaskOptions) {
		this.id = opts.id;
		this.title = opts.title;
		if (opts.iconPath.dark) {
			this.iconPath = {
				dark: URI.parse(opts.iconPath.dark),
				light: opts.iconPath.light ? URI.parse(opts.iconPath.light) : undefined,
			};
		}
		this._iconClass = opts.iconClass;
		this._description = opts.description;
	}

	private toITask(): ITask {
		return {
			id: this.id,
			handler: (accessor, profile, args) => this.runTask(accessor, profile, args),
			description: this._description,
			iconClass: this._iconClass
		};
	}

	private toCommandAction(): ICommandAction {
		return {
			iconLocation: this.iconPath,
			id: this.id,
			title: this.title
		};
	}

	public registerTask(): IDisposable {
		MenuRegistry.addCommand(this.toCommandAction());
		return TaskRegistry.registerTask(this.toITask());
	}

	public abstract runTask(accessor: ServicesAccessor, profile: IConnectionProfile, args: any): void | Promise<void>;
}

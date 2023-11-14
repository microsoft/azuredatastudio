/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IDisposable } from 'vs/base/common/lifecycle';

import { IWorkspaceFolder, IWorkspace } from 'vs/platform/workspace/common/workspace';
import { Task, ContributedTask, CustomTask, ITaskSet, TaskSorter, ITaskEvent, ITaskIdentifier, ConfiguringTask, TaskRunSource } from 'vs/workbench/contrib/tasks/common/tasks';
import { ITaskSummary, ITaskTerminateResponse, ITaskSystemInfo } from 'vs/workbench/contrib/tasks/common/taskSystem';
import { IStringDictionary } from 'vs/base/common/collections';
import { RawContextKey, ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';

export { ITaskSummary, Task, ITaskTerminateResponse as TaskTerminateResponse };

export const CustomExecutionSupportedContext = new RawContextKey<boolean>('customExecutionSupported', false, nls.localize('tasks.customExecutionSupported', "Whether CustomExecution tasks are supported. Consider using in the when clause of a \'taskDefinition\' contribution."));
export const ShellExecutionSupportedContext = new RawContextKey<boolean>('shellExecutionSupported', false, nls.localize('tasks.shellExecutionSupported', "Whether ShellExecution tasks are supported. Consider using in the when clause of a \'taskDefinition\' contribution."));
export const TaskCommandsRegistered = new RawContextKey<boolean>('taskCommandsRegistered', false, nls.localize('tasks.taskCommandsRegistered', "Whether the task commands have been registered yet"));
export const ProcessExecutionSupportedContext = new RawContextKey<boolean>('processExecutionSupported', false, nls.localize('tasks.processExecutionSupported', "Whether ProcessExecution tasks are supported. Consider using in the when clause of a \'taskDefinition\' contribution."));
export const ServerlessWebContext = new RawContextKey<boolean>('serverlessWebContext', false, nls.localize('tasks.serverlessWebContext', "True when in the web with no remote authority."));
export const TaskExecutionSupportedContext = ContextKeyExpr.or(ContextKeyExpr.and(ShellExecutionSupportedContext, ProcessExecutionSupportedContext), CustomExecutionSupportedContext);

export const ITaskService = createDecorator<ITaskService>('taskService');

export interface ITaskProvider {
	provideTasks(validTypes: IStringDictionary<boolean>): Promise<ITaskSet>;
	resolveTask(task: ConfiguringTask): Promise<ContributedTask | undefined>;
}

export interface IProblemMatcherRunOptions {
	attachProblemMatcher?: boolean;
}

export interface ICustomizationProperties {
	group?: string | { kind?: string; isDefault?: boolean };
	problemMatcher?: string | string[];
	isBackground?: boolean;
	color?: string;
	icon?: string;
}

export interface ITaskFilter {
	version?: string;
	type?: string;
	task?: string;
}

interface IWorkspaceTaskResult {
	set: ITaskSet | undefined;
	configurations: {
		byIdentifier: IStringDictionary<ConfiguringTask>;
	} | undefined;
	hasErrors: boolean;
}

export interface IWorkspaceFolderTaskResult extends IWorkspaceTaskResult {
	workspaceFolder: IWorkspaceFolder;
}

export interface ITaskService {
	readonly _serviceBrand: undefined;
	onDidStateChange: Event<ITaskEvent>;
	supportsMultipleTaskExecutions: boolean;

	configureAction(): Action;
	run(task: Task | undefined, options?: IProblemMatcherRunOptions): Promise<ITaskSummary | undefined>;
	inTerminal(): boolean;
	getActiveTasks(): Promise<Task[]>;
	getBusyTasks(): Promise<Task[]>;
	terminate(task: Task): Promise<ITaskTerminateResponse>;
	tasks(filter?: ITaskFilter): Promise<Task[]>;
	taskTypes(): string[];
	getWorkspaceTasks(runSource?: TaskRunSource): Promise<Map<string, IWorkspaceFolderTaskResult>>;
	getSavedTasks(type: 'persistent' | 'historical'): Promise<(Task | ConfiguringTask)[]>;
	removeRecentlyUsedTask(taskRecentlyUsedKey: string): void;
	/**
	 * @param alias The task's name, label or defined identifier.
	 */
	getTask(workspaceFolder: IWorkspace | IWorkspaceFolder | string, alias: string | ITaskIdentifier, compareId?: boolean): Promise<Task | undefined>;
	tryResolveTask(configuringTask: ConfiguringTask): Promise<Task | undefined>;
	createSorter(): TaskSorter;

	getTaskDescription(task: Task | ConfiguringTask): string | undefined;
	customize(task: ContributedTask | CustomTask | ConfiguringTask, properties?: {}, openConfig?: boolean): Promise<void>;
	openConfig(task: CustomTask | ConfiguringTask | undefined): Promise<boolean>;

	registerTaskProvider(taskProvider: ITaskProvider, type: string): IDisposable;

	registerTaskSystem(scheme: string, taskSystemInfo: ITaskSystemInfo): void;
	onDidChangeTaskSystemInfo: Event<void>;
	readonly hasTaskSystemInfo: boolean;
	registerSupportedExecutions(custom?: boolean, shell?: boolean, process?: boolean): void;

	extensionCallbackTaskComplete(task: Task, result: number | undefined): Promise<void>;
}

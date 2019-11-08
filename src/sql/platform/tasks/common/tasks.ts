/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

import * as types from 'vs/base/common/types';
import { ILocalizedString, ICommandAction } from 'vs/platform/actions/common/actions';
import { Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

export interface ITaskOptions {
	id: string;
	title: string;
	iconPath: { dark: string; light?: string; };
	description?: ITaskHandlerDescription;
	iconClass?: string;
}

export interface ITaskHandlerDescription {
	description: string;
	args: { name: string; description?: string; constraint?: types.TypeConstraint; }[];
	returns?: string;
}

export interface ITaskEvent {
	taskId: string;
}

export interface ITaskAction {
	id: string;
	title: string | ILocalizedString;
	category?: string | ILocalizedString;
	iconClass?: string;
	iconPath?: string;
}

export interface ITaskHandler {
	(accessor: ServicesAccessor, profile: IConnectionProfile, ...args: any[]): void;
}

export interface ITask {
	id: string;
	handler: ITaskHandler;
	precondition?: ContextKeyExpr;
	description?: ITaskHandlerDescription;
	iconClass?: string;
}

export interface ITaskRegistry {
	registerTask(id: string, command: ITaskHandler): IDisposable;
	registerTask(command: ITask): IDisposable;
	getTasks(): string[];
	getOrCreateTaskIconClassName(item: ICommandAction): string | undefined;
	onTaskRegistered: Event<string>;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as platform from 'vs/platform/registry/common/platform';
import { IJSONSchema, IJSONSchemaMap } from 'vs/base/common/jsonSchema';
import { Action } from 'vs/base/common/actions';
import { IConstructorSignature3 } from 'vs/platform/instantiation/common/instantiation';
import * as nls from 'vs/nls';

export type TaskIdentifier = string;

export interface ActionICtor extends IConstructorSignature3<string, string, string, TaskAction> {
	ID: string;
	LABEL: string;
	ICON: string;
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
	 * Registers an action as a task which can be ran given the schema as an input
	 * @param id id of the task
	 * @param description desciption of the task
	 * @param schema schema of expected input
	 * @param ctor contructor of the action
	 */
	registerTask(id: string, description: string, schema: IJSONSchema, ctor: ActionICtor): TaskIdentifier;
}

class TaskRegistry implements ITaskRegistry {
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

	/**
	 * Registers an action as a task which can be ran given the schema as an input
	 * @param id id of the task
	 * @param description desciption of the task
	 * @param schema schema of expected input
	 * @param ctor contructor of the action
	 */
	registerTask(id: string, description: string, schema: IJSONSchema, ctor: ActionICtor): TaskIdentifier {
		this._idCtorMap[id] = ctor;
		this._taskSchema.properties[id] = schema;
		return id;
	}
}

const taskRegistry = new TaskRegistry();
platform.Registry.add(Extensions.TaskContribution, taskRegistry);

export function registerTask(id: string, description: string, schema: IJSONSchema, ctor: ActionICtor): TaskIdentifier {
	return taskRegistry.registerTask(id, description, schema, ctor);
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IAction } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TaskNode, TaskStatus, TaskExecutionMode } from 'sql/workbench/services/tasks/common/tasksNode';
import { CancelAction, ScriptAction } from 'sql/workbench/contrib/tasks/common/tasksAction';

/**
 *  Provides actions for the history tasks
 */
export class TaskHistoryActionProvider {

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
	}

	public hasActions(tree: ITree, element: any): boolean {
		return element instanceof TaskNode;
	}

	/**
	 * Return actions given an element in the tree
	 */
	public getActions(tree: ITree, element: any): IAction[] {
		if (element instanceof TaskNode) {
			return this.getTaskHistoryActions(tree, element);
		}
		return [];
	}

	public hasSecondaryActions(tree: ITree, element: any): boolean {
		return false;
	}

	/**
	 * Return actions for history task
	 */
	public getTaskHistoryActions(tree: ITree, element: TaskNode): IAction[] {
		let actions = [];

		// get actions for tasks in progress
		if (element.status === TaskStatus.InProgress && element.isCancelable) {
			actions.push(this._instantiationService.createInstance(CancelAction, CancelAction.ID, CancelAction.LABEL));
		}

		// get actions for tasks succeeded
		if (element.status === TaskStatus.Succeeded || element.status === TaskStatus.SucceededWithWarning) {
			if (element.taskExecutionMode === TaskExecutionMode.executeAndScript) {
				actions.push(this._instantiationService.createInstance(ScriptAction, ScriptAction.ID, ScriptAction.LABEL));
			}
		}

		return actions;
	}
}

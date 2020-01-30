/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree, IDataSource } from 'vs/base/parts/tree/browser/tree';
import { TaskNode } from 'sql/workbench/services/tasks/common/tasksNode';

/**
 * Implements the DataSource(that returns a parent/children of an element) for the task history
 */
export class TaskHistoryDataSource implements IDataSource {

	/**
	 * Returns the unique identifier of the given element.
	 * No more than one element may use a given identifier.
	 */
	public getId(tree: ITree, element: any): string {
		if (element instanceof TaskNode) {
			return (<TaskNode>element).id;
		} else {
			return undefined;
		}
	}

	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(tree: ITree, element: any): boolean {
		if (element instanceof TaskNode) {
			return (<TaskNode>element).hasChildren;
		}
		return false;
	}

	/**
	 * Returns the element's children as an array in a promise.
	 */
	public getChildren(tree: ITree, element: any): Promise<any> {
		if (element instanceof TaskNode) {
			return Promise.resolve((<TaskNode>element).children);
		}
		return Promise.resolve(null);
	}

	/**
	 * Returns the element's parent in a promise.
	 */
	public getParent(tree: ITree, element: any): Promise<any> {
		return Promise.resolve(null);
	}
}

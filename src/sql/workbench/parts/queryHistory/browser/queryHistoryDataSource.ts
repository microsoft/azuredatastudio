/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree, IDataSource } from 'vs/base/parts/tree/browser/tree';
import { QueryHistoryNode } from 'sql/workbench/parts/queryHistory/browser/queryHistoryNode';

/**
 * Implements the DataSource (that returns a parent/children of an element) for the query history
 */
export class QueryHistoryDataSource implements IDataSource {

	/**
	 * Returns the unique identifier of the given element.
	 * No more than one element may use a given identifier.
	 */
	public getId(tree: ITree, element: any): string {
		if (element instanceof QueryHistoryNode && element.info) {
			return element.info.id;
		}
		return undefined;
	}

	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(tree: ITree, element: any): boolean {
		if (element instanceof QueryHistoryNode) {
			return element.hasChildren;
		}
		return false;
	}

	/**
	 * Returns the element's children as an array
	 */
	public async getChildren(tree: ITree, element: any): Promise<any> {
		if (element instanceof QueryHistoryNode) {
			return element.children;
		}
		return undefined;
	}

	/**
	 * Returns the element's parent
	 */
	public async getParent(tree: ITree, element: any): Promise<any> {
		return undefined;
	}
}

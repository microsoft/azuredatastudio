/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ITree, IDataSource } from 'vs/base/parts/tree/browser/tree';
import { TPromise } from 'vs/base/common/winjs.base';
import { TreeNode } from 'sql/parts/modelComponents/tree/treeDataModel';

/**
 * Implements the DataSource(that returns a parent/children of an element) for the recent connection tree
 */
export class TreeComponentDataSource implements IDataSource {

	/**
	 * Returns the unique identifier of the given element.
	 * No more than one element may use a given identifier.
	 */
	public getId(tree: ITree, element: any): string {
		let treeElement = <TreeNode>element;
		return treeElement && treeElement.id;
	}

	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(tree: ITree, element: any): boolean {
		let treeElement = <TreeNode>element;
		return treeElement && treeElement.hasChildren;
	}

	/**
	 * Returns the element's children as an array in a promise.
	 */
	public getChildren(tree: ITree, element: any): TPromise<any> {
		let treeElement = <TreeNode>element;
		if (treeElement && treeElement.hasChildren) {
			return TPromise.as(treeElement.children);
		} else {
			return TPromise.as([]);
		}
	}

	/**
	 * Returns the element's parent in a promise.
	 */
	public getParent(tree: ITree, element: any): TPromise<any> {
		let treeElement = <TreeNode>element;
		if (treeElement && treeElement.parent) {
			return TPromise.as(treeElement.parent);
		} else {
			return TPromise.as(undefined);
		}
	}
}
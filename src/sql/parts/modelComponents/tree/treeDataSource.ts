/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ITree, IDataSource } from 'vs/base/parts/tree/browser/tree';
import { TPromise } from 'vs/base/common/winjs.base';
import * as sqlops from 'sqlops';

/**
 * Implements the DataSource(that returns a parent/children of an element) for the recent connection tree
 */
export class TreeComponentDataSource implements IDataSource {

	/**
	 * Returns the unique identifier of the given element.
	 * No more than one element may use a given identifier.
	 */
	public getId(tree: ITree, element: any): string {
		let treeElement = <sqlops.TreeComponentDataModel>element;
		return treeElement && treeElement.id;
	}

	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(tree: ITree, element: any): boolean {
		let treeElement = <sqlops.TreeComponentDataModel>element;
		return treeElement && treeElement.children !== undefined;
	}

	/**
	 * Returns the element's children as an array in a promise.
	 */
	public getChildren(tree: ITree, element: any): TPromise<any> {
		let treeElement = <sqlops.TreeComponentDataModel>element;
		if (treeElement && treeElement.children) {
			return TPromise.as(treeElement.children);
		} else {
			return TPromise.as([]);
		}
	}

	/**
	 * Returns the element's parent in a promise.
	 */
	public getParent(tree: ITree, element: any): TPromise<any> {
		let treeElement = <sqlops.TreeComponentDataModel>element;
		return TPromise.as(treeElement && treeElement.parent !== undefined);
	}
}
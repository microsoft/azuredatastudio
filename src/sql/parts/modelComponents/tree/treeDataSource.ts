/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ITree, IDataSource } from 'vs/base/parts/tree/browser/tree';
import { TPromise } from 'vs/base/common/winjs.base';
import { IModelViewTreeViewDataProvider, ITreeComponentItem } from 'sql/workbench/common/views';
import { TreeItemCollapsibleState } from 'vs/workbench/common/views';

/**
 * Implements the DataSource(that returns a parent/children of an element) for the recent connection tree
 */
export class TreeComponentDataSource implements IDataSource {

	/**
	 *
	 */
	constructor(
		private _dataProvider: IModelViewTreeViewDataProvider) {

	}

	/**
	 * Returns the unique identifier of the given element.
	 * No more than one element may use a given identifier.
	 */
	public getId(tree: ITree, node: ITreeComponentItem): string {
		return node.handle;
	}

	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(tree: ITree, node: ITreeComponentItem): boolean {
		return this._dataProvider !== undefined && node.collapsibleState !== TreeItemCollapsibleState.None;
	}

	/**
	 * Returns the element's children as an array in a promise.
	 */
	public getChildren(tree: ITree, node: ITreeComponentItem): TPromise<any> {
		if (this._dataProvider) {
			if (node && node.handle === '0') {
				return this._dataProvider.getChildren(undefined);
			} else {
				return this._dataProvider.getChildren(node);
			}
		}
		return TPromise.as([]);
	}

	public getParent(tree: ITree, node: any): TPromise<any> {
		return TPromise.as(null);
	}

	public shouldAutoexpand(tree: ITree, node: ITreeComponentItem): boolean {
		return node.collapsibleState === TreeItemCollapsibleState.Expanded;
	}
}
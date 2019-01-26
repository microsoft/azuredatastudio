/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ITree, IDataSource } from 'vs/base/parts/tree/browser/tree';
import { TPromise } from 'vs/base/common/winjs.base';

/**
 * Implements the DataSource(that returns a parent/children of an element) for the recent connection tree
 */
export class RecentConnectionDataSource implements IDataSource {

	/**
	 * Returns the unique identifier of the given element.
	 * No more than one element may use a given identifier.
	 */
	public getId(tree: ITree, element: any): string {
		if (element instanceof ConnectionProfile) {
			return (<ConnectionProfile>element).id;
		} else if (element instanceof ConnectionProfileGroup) {
			return (<ConnectionProfileGroup>element).id;
		} else {
			return undefined;
		}
	}

	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(tree: ITree, element: any): boolean {
		if (element instanceof ConnectionProfile) {
			return false;
		} else if (element instanceof ConnectionProfileGroup) {
			return (<ConnectionProfileGroup>element).hasChildren();
		}
		return false;
	}

	/**
	 * Returns the element's children as an array in a promise.
	 */
	public getChildren(tree: ITree, element: any): TPromise<any> {
		if (element instanceof ConnectionProfile) {
			return TPromise.as(null);
		} else if (element instanceof ConnectionProfileGroup) {
			return TPromise.as((<ConnectionProfileGroup>element).getChildren());
		} else {
			return TPromise.as(null);
		}
	}

	/**
	 * Returns the element's parent in a promise.
	 */
	public getParent(tree: ITree, element: any): TPromise<any> {
		if (element instanceof ConnectionProfile) {
			return TPromise.as((<ConnectionProfile>element).getParent());
		} else if (element instanceof ConnectionProfileGroup) {
			return TPromise.as((<ConnectionProfileGroup>element).getParent());
		} else {
			return TPromise.as(null);
		}
	}
}
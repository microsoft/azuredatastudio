/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { IAsyncDataSource } from 'vs/base/browser/ui/tree/tree';
import { ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';

/**
 * Implements the DataSource(that returns a parent/children of an element) for the recent connection tree
 */
export class AsyncRecentConnectionTreeDataSource implements IAsyncDataSource<ConnectionProfileGroup, ServerTreeElement> {

	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(element: ServerTreeElement): boolean {
		if (element instanceof ConnectionProfileGroup) {
			return element.hasChildren();
		}
		return false;
	}

	/**
	 * Returns the element's children as an array in a promise.
	 */
	public async getChildren(element: ServerTreeElement): Promise<Iterable<ServerTreeElement>> {
		if (element instanceof ConnectionProfileGroup) {
			return element.getChildren();
		} else {
			return [];
		}
	}
}

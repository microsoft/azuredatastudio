/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileBrowserService } from 'sql/workbench/services/fileBrowser/common/interfaces';
import { FileNode } from 'sql/workbench/services/fileBrowser/common/fileNode';
import { ITree, IDataSource } from 'vs/base/parts/tree/browser/tree';

/**
 * Implements the DataSource(that returns a parent/children of an element) for the file browser
 */
export class FileBrowserDataSource implements IDataSource {

	constructor(
		@IFileBrowserService private _fileBrowserService: IFileBrowserService
	) {
	}

	/**
	 * Returns the unique identifier of the given element.
	 * No more than one element may use a given identifier.
	 */
	public getId(tree: ITree, element: any): string {
		if (element instanceof FileNode) {
			return (<FileNode>element).id;
		} else {
			return undefined;
		}
	}

	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(tree: ITree, element: any): boolean {
		if (element instanceof FileNode) {
			return (<FileNode>element).hasChildren;
		}
		return false;
	}

	/**
	 * Returns the element's children as an array in a promise.
	 */
	public getChildren(tree: ITree, element: any): Promise<any> {
		return new Promise<any>((resolve) => {
			if (element instanceof FileNode) {
				let node = <FileNode>element;
				if (node.children) {
					resolve(node.children);
				} else {
					this._fileBrowserService.expandFolderNode(node).then((nodeChildren) => {
						resolve(nodeChildren);
					}, expandError => {
						resolve([]);
					});
				}
			} else {
				resolve([]);
			}
		});
	}

	/**
	 * Returns the element's parent in a promise.
	 */
	public getParent(tree: ITree, element: any): Promise<any> {
		return Promise.resolve(null);
	}
}

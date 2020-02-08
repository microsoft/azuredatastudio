/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from 'vs/base/common/uuid';

/**
 * File/folder node in file browser
 * FileTreeNode is converted to this FileNode for UI interactions
 */
export class FileNode {
	/**
	* Node id
	*/
	public id: string;

	/**
	* Connection uri
	*/
	public ownerUri: string;

	/**
	* File or folder name
	*/
	public name: string;

	/**
	* Full path of file or folder
	*/
	public fullPath: string;

	/**
	* Parent node
	*/
	public parent?: FileNode;

	/**
	* Children nodes
	*/
	public children?: FileNode[];

	/**
	* Is the node expanded
	*/
	public isExpanded: boolean;

	/**
	* Is the node file or folder
	*/
	public isFile: boolean;

	/**
	* Does this node have children
	*/
	public hasChildren?: boolean;

	constructor(id: string, name: string, fullPath: string, isFile: boolean, isExpanded: boolean, ownerUri: string, parent?: FileNode) {
		if (id) {
			this.id = id;
		} else {
			this.id = generateUuid();
		}

		this.name = name;
		this.fullPath = fullPath;
		this.isFile = isFile;
		this.ownerUri = ownerUri;
		this.isExpanded = isExpanded;
		this.parent = parent;
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class SqlDatabaseProjectItem {
	label: string;
	readonly isFolder: boolean;
	readonly parent?: SqlDatabaseProjectItem;
	children: SqlDatabaseProjectItem[] = [];

	constructor(label: string, isFolder: boolean, parent?: SqlDatabaseProjectItem) {
		this.label = label;
		this.isFolder = isFolder;
		this.parent = parent;
	}

	public createChild(label: string, isFolder: boolean): SqlDatabaseProjectItem {
		let child = new SqlDatabaseProjectItem(label, isFolder, this);
		this.children.push(child);

		return child;
	}
}

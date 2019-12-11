/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class SqlDatabaseProjectItem {
	label: string;
	readonly isFolder: boolean;
	children: SqlDatabaseProjectItem[] = [];

	constructor(label: string, isFolder: boolean) {
		this.label = label;
		this.isFolder = isFolder;
	}
}

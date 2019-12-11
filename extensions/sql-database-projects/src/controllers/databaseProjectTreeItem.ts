/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class SqlDatabaseProjectItem {
	readonly label: string;
	readonly children: SqlDatabaseProjectItem[];

	constructor(itemName: string, children: SqlDatabaseProjectItem[]) {

		this.label = itemName;
		this.children = children;
	}
}

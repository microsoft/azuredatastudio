/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class BookTreeItem extends vscode.TreeItem {

	constructor(
		public readonly title: string,
		public readonly root: string,
		public readonly tableOfContents: Object[],
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public uri?: string,
		public readonly type?: vscode.FileType,
		public command?: vscode.Command
	) {
		super(title, collapsibleState);
	}

	contextValue = 'book';

}
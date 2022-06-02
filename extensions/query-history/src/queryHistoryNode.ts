/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Query history node
 */
export class QueryHistoryNode extends vscode.TreeItem {
	constructor(
		public readonly queryText: string,
		public readonly connectionId: string,
		public readonly providerId: string,
		tooltip: string,
		timeStamp: Date,
		isSuccess: boolean
	) {
		super(queryText, vscode.TreeItemCollapsibleState.None);
		this.iconPath = isSuccess ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed')) : new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
		this.tooltip = tooltip;
		this.description = timeStamp.toLocaleString();
	}
}

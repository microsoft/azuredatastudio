/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { removeNewLines } from './utils';

export class QueryHistoryNode extends vscode.TreeItem {
	constructor(
		public readonly queryText: string,
		public readonly connectionProfile: azdata.connection.ConnectionProfile | undefined,
		timestamp: Date,
		isSuccess: boolean
	) {
		super(removeNewLines(queryText), vscode.TreeItemCollapsibleState.None);
		this.iconPath = isSuccess ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed')) : new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
		this.tooltip = queryText;
		this.description = connectionProfile ? `${connectionProfile.serverName}|${connectionProfile.databaseName} ${timestamp.toLocaleString()}` : timestamp.toLocaleString();
	}
}

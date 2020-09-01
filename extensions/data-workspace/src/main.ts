/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	vscode.window.registerTreeDataProvider('dataworkspace.views.main', new ProjectsTree());
	vscode.commands.registerCommand('projects.addProject', () => {
	});
}

export function deactivate(): void {
}

export class ProjectsTree implements vscode.TreeDataProvider<TreeItem>{
	private _onDidChangeTreeData: vscode.EventEmitter<void | TreeItem | null | undefined> | undefined = new vscode.EventEmitter<TreeItem | undefined | void>();
	readonly onDidChangeTreeData?: vscode.Event<void | TreeItem | null | undefined> | undefined = this._onDidChangeTreeData?.event;
	getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}
	getChildren(element?: TreeItem | undefined): vscode.ProviderResult<TreeItem[]> {
		return [
			new TreeItem('abc', vscode.TreeItemCollapsibleState.Collapsed)
		];
	}
}

export class TreeItem extends vscode.TreeItem {
	constructor(public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command) {
		super(label, collapsibleState);
	}
}

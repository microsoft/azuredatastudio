/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as constants from '../common/constants';

import { SqlDatabaseProjectItem } from './databaseProjectTreeItem';

export class SqlDatabaseProjectTreeViewProvider implements vscode.TreeDataProvider<SqlDatabaseProjectItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<SqlDatabaseProjectItem | undefined> = new vscode.EventEmitter<SqlDatabaseProjectItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<SqlDatabaseProjectItem | undefined> = this._onDidChangeTreeData.event;

	private roots: SqlDatabaseProjectItem[] = [];

	constructor() {
		this.initialize();
	}

	private initialize() {
		this.roots = [new SqlDatabaseProjectItem(constants.noOpenProjectMessage, false)];
	}

	public getTreeItem(element: SqlDatabaseProjectItem): vscode.TreeItem {
		return {
			label: element.label,
			collapsibleState: element.parent === undefined
				? vscode.TreeItemCollapsibleState.Expanded
				: element.isFolder
					? vscode.TreeItemCollapsibleState.Collapsed
					: vscode.TreeItemCollapsibleState.None
		};
	}

	public getChildren(element?: SqlDatabaseProjectItem): SqlDatabaseProjectItem[] {
		if (element === undefined) {
			return this.roots;
		}

		return element.children;
	}

	public async openProject(projectFiles: vscode.Uri[]) {
		if (projectFiles.length > 1) { // TODO: how to handle opening a folder with multiple .sqlproj files?
			vscode.window.showErrorMessage(constants.multipleSqlProjFiles);
			return;
		}

		if (projectFiles.length === 0) {
			vscode.window.showErrorMessage(constants.noSqlProjFiles);
			return;
		}

		let directoryPath = path.dirname(projectFiles[0].fsPath);
		console.log('Opening project directory: ' + directoryPath);

		let newRoots: SqlDatabaseProjectItem[] = [];

		newRoots.push(await this.constructDataSourcesTree(directoryPath));
		newRoots.push(await this.constructProjectTree(directoryPath));

		this.roots = newRoots;
		this._onDidChangeTreeData.fire();
	}

	private async constructProjectTree(directoryPath: string): Promise<SqlDatabaseProjectItem> {
		let projectsNode = await this.constructFileTreeNode(directoryPath, undefined);

		projectsNode.label = constants.projectNodeName;

		return projectsNode;
	}

	private async constructFileTreeNode(entryPath: string, parentNode: SqlDatabaseProjectItem | undefined): Promise<SqlDatabaseProjectItem> {
		let stat = await fs.stat(entryPath);

		let output = parentNode === undefined
			? new SqlDatabaseProjectItem(path.basename(entryPath), stat.isDirectory())
			: parentNode.createChild(path.basename(entryPath), stat.isDirectory());

		if (stat.isDirectory()) {
			let contents = await fs.readdir(entryPath);

			for (const entry of contents) {
				await this.constructFileTreeNode(path.join(entryPath, entry), output);
			}

			// sort children so that folders come first, then alphabetical
			output.children.sort((a: SqlDatabaseProjectItem, b: SqlDatabaseProjectItem) => {
				if (a.isFolder && !b.isFolder) { return -1; }
				else if (!a.isFolder && b.isFolder) { return 1; }
				else { return a.label.localeCompare(b.label); }
			});
		}

		return output;
	}

	private async constructDataSourcesTree(directoryPath: string): Promise<SqlDatabaseProjectItem> {
		let dataSourceNode = new SqlDatabaseProjectItem(constants.dataSourcesNodeName, true);

		let dataSourcesFilePath = path.join(directoryPath, constants.dataSourcesFileName);

		try {
			let connections = await fs.readFile(dataSourcesFilePath, 'r');

			// TODO: parse connections.json

			dataSourceNode.createChild(constants.foundDataSourcesFile + connections.length, false);
		}
		catch {
			dataSourceNode.createChild(constants.noDataSourcesFile, false);
		}

		return dataSourceNode;
	}
}

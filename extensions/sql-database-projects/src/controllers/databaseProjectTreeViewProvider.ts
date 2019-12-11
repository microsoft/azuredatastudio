/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as nls from 'vscode-nls';

import { SqlDatabaseProjectItem } from './databaseProjectTreeItem';
import { Deferred } from '../common/promise';


const localize = nls.loadMessageBundle();

export class SqlDatabaseProjectTreeViewProvider implements vscode.TreeDataProvider<SqlDatabaseProjectItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<SqlDatabaseProjectItem | undefined> = new vscode.EventEmitter<SqlDatabaseProjectItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<SqlDatabaseProjectItem | undefined> = this._onDidChangeTreeData.event;

	private _initializeDeferred: Deferred<void> = new Deferred<void>();

	private roots: SqlDatabaseProjectItem[] = [];

	constructor() {
		this._initializeDeferred = new Deferred<void>();
		this.initialize();
	}

	async initialize() {
		this.roots = [new SqlDatabaseProjectItem(localize('noProjectOpenMessage', "No open database project"), false)];


		this._initializeDeferred.resolve();
	}

	getTreeItem(element: SqlDatabaseProjectItem): vscode.TreeItem {
		return {
			label: element.label,
			collapsibleState: element.parent === undefined
				? vscode.TreeItemCollapsibleState.Expanded
				: element.isFolder
					? vscode.TreeItemCollapsibleState.Collapsed
					: vscode.TreeItemCollapsibleState.None
		};
	}

	getChildren(element?: SqlDatabaseProjectItem): SqlDatabaseProjectItem[] {
		if (element === undefined) {
			return this.roots;
		}

		return element.children;
	}

	public get initialized(): Promise<void> {
		return this._initializeDeferred.promise;
	}

	async openProject(projectFiles: vscode.Uri[]) {
		if (projectFiles.length > 1) { // TODO: how to handle opening a folder with multiple .sqlproj files?
			vscode.window.showErrorMessage('Multiple .sqlproj files selected; please select only one.');
		}

		if (projectFiles.length === 0) {
			vscode.window.showErrorMessage('No .sqlproj file selected; please select one.');
		}

		let directoryPath = path.dirname(projectFiles[0].fsPath);
		console.log('Opening project directory: ' + directoryPath);

		let newRoots: SqlDatabaseProjectItem[] = [];

		newRoots.push(await this.constructConnectionsTree(directoryPath));
		newRoots.push(await this.constructProjectTree(directoryPath));

		this.roots = newRoots;
		this._onDidChangeTreeData.fire();
	}

	private async constructProjectTree(directoryPath: string): Promise<SqlDatabaseProjectItem> {
		let projectsNode = await this.constructFileTreeNode(directoryPath, undefined);

		projectsNode.label = localize('projectNodeName', "Database Project");

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

	private async constructConnectionsTree(directoryPath: string): Promise<SqlDatabaseProjectItem> {
		let connectionsNode = new SqlDatabaseProjectItem(localize('connectionsNodeName', "Connections"), true);

		let connectionsFilePath = path.join(directoryPath, 'connections.json');

		try {
			let connections = await fs.readFile(connectionsFilePath, 'r');

			// TODO: parse connections.json

			connectionsNode.createChild('Found connections.json: ' + connections.length, false);
		}
		catch {
			connectionsNode.createChild(localize('noConnectionsFile', "No connections.json found"), false);
		}

		return connectionsNode;
	}
}

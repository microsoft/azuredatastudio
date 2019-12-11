/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
//import {promises as fs} from 'fs'; // TODO: how to access I/O flags in fs (not fs.promises) when aliased?
import * as fs from 'fs';
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
		this.roots = [new SqlDatabaseProjectItem(localize('noProjectOpenMessage', "No open Database Project"), [])];


		this._initializeDeferred.resolve();
	}

	getTreeItem(element: SqlDatabaseProjectItem): vscode.TreeItem {
		return {
			label: element.label,
			collapsibleState: element.children.length === 0 ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded
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
		let connectionsNode = new SqlDatabaseProjectItem(localize('projectNodeName', "Database Project"), []);

		let contents = await fs.promises.readdir(directoryPath);

		for (const entry of contents) {
			connectionsNode.children.push(await this.constructFileTreeNode(path.join(directoryPath, entry)));
		}

		return connectionsNode;
	}

	private async constructFileTreeNode(entryPath: string): Promise<SqlDatabaseProjectItem> {
		let output = new SqlDatabaseProjectItem(path.basename(entryPath), []);
		let stat = await fs.promises.stat(entryPath);

		if (stat.isDirectory()) {
			let contents = await fs.promises.readdir(entryPath);

			for (const entry of contents) {
				output.children.push(await this.constructFileTreeNode(path.join(entryPath, entry)));
			}
		}

		return output;
	}

	private async constructConnectionsTree(directoryPath: string): Promise<SqlDatabaseProjectItem> {
		let connectionsNode = new SqlDatabaseProjectItem(localize('connectionsNodeName', "Connections"), []);

		let connectionsFilePath = path.join(directoryPath, 'connections.json');

		try {
			let connections = await fs.promises.readFile(connectionsFilePath, 'r');

			// TODO: parse connections.json

			connectionsNode.children.push(new SqlDatabaseProjectItem('Found connections.json: ' + connections.length, []));
		}
		catch {
			connectionsNode.children.push(new SqlDatabaseProjectItem(localize('noConnectionsFile', "No connections.json found"), []));
		}

		return connectionsNode;
	}
}

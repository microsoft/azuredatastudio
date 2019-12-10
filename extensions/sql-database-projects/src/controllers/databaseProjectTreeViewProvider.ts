/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { SqlDatabaseProjectItem } from './databaseProjectTreeItem';
import { Deferred } from '../common/promise';
import { fstat } from 'fs';

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
		this.roots = this.parseTreeNode(this.tree);
		this._initializeDeferred.resolve();
	}

	getTreeItem(element: SqlDatabaseProjectItem): SqlDatabaseProjectItem {
		return element;
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

	openProject(file: vscode.Uri[]) {
		console.log('Opening project file: ' + file[0].fsPath);
		//fs.readdir()
	}

	private parseTreeNode(node: any): SqlDatabaseProjectItem[] {
		let output: SqlDatabaseProjectItem[] = [];

		for (let i = 0; i < Object.keys(node).length; i++) {
			let grandchildren = this.parseTreeNode(node[Object.keys(node)[i]]);
			let child = new SqlDatabaseProjectItem(Object.keys(node)[i], grandchildren);

			output.push(child);
		}

		return output;
	}

	tree = {
		'Connections': {
			'aa': {
				'aaa': {
					'aaaa': {
						'aaaaa': {
							'aaaaaa': {

							}
						}
					}
				}
			},
			'ab': {}
		},
		'SQL Projects': {
			'ba': {},
			'bb': {}
		}
	};
}

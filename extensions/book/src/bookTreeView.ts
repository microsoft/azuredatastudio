/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';


export class BookTreeViewProvider implements vscode.TreeDataProvider<Notebook> {

	private _onDidChangeTreeData: vscode.EventEmitter<Notebook | undefined> = new vscode.EventEmitter<Notebook | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Notebook | undefined> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string) {
		// TODO: Only show BOOK tab if a book is opened
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	async openNotebook(resource: vscode.Uri): Promise<void> {
		let doc = await vscode.workspace.openTextDocument(resource);
		vscode.window.showTextDocument(doc);
	}

	getTreeItem(element: Notebook): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Notebook): Thenable<Notebook[]> {
		if (element) {
			return Promise.resolve(this.getNotebooks(path.join(this.workspaceRoot, '_data', 'toc.yml')));
		} else {
			const tocPath = path.join(this.workspaceRoot, '_data', 'toc.yml');
			if (this.pathExists(tocPath)) {
				return Promise.resolve(this.getNotebooks(tocPath));
			} else {
				vscode.window.showInformationMessage('Workspace has no toc.yml');
				return Promise.resolve([]);
			}
		}

	}

	/**
	 * Given the path to toc.yml, read all notebooks.
	 */
	private getNotebooks(TOCPath: string): Notebook[] {
		if (this.pathExists(TOCPath)) {
			const toc = yaml.safeLoad(fs.readFileSync(TOCPath, 'utf-8'));
			let notebooks: Notebook[] = [];

			// TODO: check if it's a directory (right now assuming all are just notebooks)
			for (let i = 0; i < Object.keys(toc).length; i++) {
				if (toc[i].url) {
					let pathToNotebook = path.join(this.workspaceRoot, 'content', String(toc[i].url).concat('.ipynb'));
					notebooks.push(new Notebook(toc[i].title, toc[i].url, vscode.FileType.File, vscode.TreeItemCollapsibleState.None, { command: 'bookTreeView.openNotebook', title: "Open Notebook", arguments: [pathToNotebook], }));
				} else {
					// TODO: figure out where search notebook is (search doesn't have uri)
					notebooks.push(new Notebook(toc[i].title, toc[i].url, vscode.FileType.File, vscode.TreeItemCollapsibleState.None));
				}
			}
			return notebooks;
		}
		return [];
	}

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}
}

export class Notebook extends vscode.TreeItem {

	constructor(
		public readonly title: string,
		public uri: string,
		public readonly type: vscode.FileType,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public command?: vscode.Command
	) {
		super(title, collapsibleState);
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'open_notebook.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'open_notebook_inverse.svg')
	};

	contextValue = 'notebook';

}
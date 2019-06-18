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
	private tocPath: string[];

	constructor(private workspaceRoot: string) {
		// TODO: Only show BOOK tab if a book is opened
		this.tocPath = [];
		this.tocPath.push(path.join(this.workspaceRoot, '_data', 'toc.yml'));
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
			if (element.sections) {
				return Promise.resolve(this.getSections(element.sections));
			} else {
				vscode.window.showInformationMessage('No sections');
				return Promise.resolve([]);
			}
		} else {
			if (this.pathExists(this.tocPath[0])) {
				return Promise.resolve(this.getNotebooks());
			} else {
				vscode.window.showInformationMessage('Workspace has no toc.yml');
			}
		}
		return Promise.resolve([]);
	}

	/**
	 * Given the path to toc.yml, read all notebooks.
	 */
	private getNotebooks(): Notebook[] {
		if (this.pathExists(this.tocPath[0])) {
			const toc = yaml.safeLoad(fs.readFileSync(this.tocPath[0], 'utf-8'));
			let notebooks: Notebook[] = [];

			for (let i = 0; i < Object.keys(toc).length; i++) {
				if (toc[i].url) {
					let pathToNotebook = path.join(this.workspaceRoot, 'content', String(toc[i].url).concat('.ipynb'));
					let pathToMarkdown = path.join(this.workspaceRoot, 'content', String(toc[i].url).concat('.md'));

					if (this.pathExists(pathToNotebook)) {
						notebooks.push(new Notebook(toc[i].title, toc[i].url, vscode.FileType.File, toc[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, toc[i].sections, { command: 'bookTreeView.openNotebook', title: 'Open Notebook', arguments: [pathToNotebook], }));
					} else {
						notebooks.push(new Notebook(toc[i].title, toc[i].url, vscode.FileType.File, toc[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, toc[i].sections, { command: 'bookTreeView.openNotebook', title: 'Open Notebook', arguments: [pathToMarkdown], }));
					}
				} else {
					// TODO: search, divider, header
				}
			}
			return notebooks;
		}
		return [];
	}

	private getSections(sec: any[]): Notebook[] {
		let notebooks: Notebook[] = [];

		for (let i = 0; i < sec.length; i++) {
			if (sec[i].url) {
				let pathToNotebook = path.join(this.workspaceRoot, 'content', String(sec[i].url).concat('.ipynb'));
				let pathToMarkdown = path.join(this.workspaceRoot, 'content', String(sec[i].url).concat('.md'));

				if (this.pathExists(pathToNotebook)) {
					notebooks.push(new Notebook(sec[i].title, sec[i].url, vscode.FileType.File, sec[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, sec[i].sections, { command: 'bookTreeView.openNotebook', title: 'Open Notebook', arguments: [pathToNotebook], }));
				} else {
					notebooks.push(new Notebook(sec[i].title, sec[i].url, vscode.FileType.File, sec[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, sec[i].sections, { command: 'bookTreeView.openNotebook', title: 'Open Notebook', arguments: [pathToMarkdown], }));
				}
			} else {
				// TODO: search, divider, header
			}
		}
		return notebooks;
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
		public sections: any[],
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

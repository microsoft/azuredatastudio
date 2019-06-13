/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';


export class BookTreeViewProvider implements vscode.TreeDataProvider<Notebook> {

	private _onDidChangeTreeData: vscode.EventEmitter<Notebook | undefined> = new vscode.EventEmitter<Notebook | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Notebook | undefined> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string) {
		// TODO: Only show BOOK tab if a book is opened
		/* const enabled = vscode.window.activeTextEditor.document.languageId === 'json' || vscode.window.activeTextEditor.document.languageId === 'jsonc';
		vscode.commands.executeCommand('setContext', 'jsonOutlineEnabled', enabled);
		vscode.commands.executeCommand('setContext', 'bookOpened', true); */
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Notebook): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Notebook): Thenable<Notebook[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('Empty workspace');
			return Promise.resolve([]);
		}

		if (element) {
			vscode.window.showInformationMessage(path.join(this.workspaceRoot, '_data', 'toc.yml'));
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
			try {
				// const toc = yaml.safeLoad(fs.readFileSync(TOCPath, 'utf-8'));
				vscode.window.showInformationMessage('toc.yml found');
			} catch (e) {
				vscode.window.showInformationMessage(e);
			}

			/*
				const toDep = (moduleName: string, version: string): Notebook => {
					if (this.pathExists(path.join(this.workspaceRoot, 'node_modules', moduleName))) {
						return new Notebook(moduleName, version, vscode.TreeItemCollapsibleState.Collapsed);
					} else {
						return new Notebook(moduleName, version, vscode.TreeItemCollapsibleState.None, {
							command: 'extension.openPackageOnNpm',
							title: '',
							arguments: [moduleName]
						});
					}
				};

				const nbs = toc.notebooks
					? Object.keys(toc.notebooks).map(nb => toDep(nb, toc.notebooks[nb]))
					: [];

				return nbs;
			} else {
				return [];
			}
			*/
		}
		return []; //temp
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
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(title, collapsibleState);
	}

	get tooltip(): string {
		return `${this.title}`;
	}

	// iconPath = {
	// 	light: path.join(__filename, '..', '..', 'resources', 'light', 'open_notebook.svg'),
	// 	dark: path.join(__filename, '..', '..', 'resources', 'dark', 'open_notebook_inverse.svg')
	// };

	contextValue = 'notebook';
}
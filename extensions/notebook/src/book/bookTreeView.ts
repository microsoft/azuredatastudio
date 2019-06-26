/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { BookTreeItem } from './bookTreeItem';
import * as utils from '../common/utils';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();


export class BookTreeViewProvider implements vscode.TreeDataProvider<BookTreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<BookTreeItem | undefined> = new vscode.EventEmitter<BookTreeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<BookTreeItem | undefined> = this._onDidChangeTreeData.event;
	private tableOfContentsPath: string[];

	constructor(private workspaceRoot: string) {
		if (workspaceRoot !== '') {
			this.tableOfContentsPath = this.getTocFiles(this.workspaceRoot);
			if (this.tableOfContentsPath === undefined || this.tableOfContentsPath.length === 0) {
				vscode.commands.executeCommand('setContext', 'bookOpened', false);
			} else {
				vscode.commands.executeCommand('setContext', 'bookOpened', true);
			}
		}
	}

	private getTocFiles(dir: string): string[] {
		let allFiles: string[] = [];
		let files = fs.readdirSync(dir);
		for (let i in files) {
			let name = path.join(dir, files[i]);
			if (fs.statSync(name).isDirectory()) {
				allFiles = allFiles.concat(this.getTocFiles(name));
			} else if (files[i] === 'toc.yml') {
				allFiles.push(name);
			}
		}
		return allFiles;
	}

	async openNotebook(resource: vscode.Uri): Promise<void> {
		try {
			let doc = await vscode.workspace.openTextDocument(resource);
			vscode.window.showTextDocument(doc);
		} catch (e) {
			vscode.window.showErrorMessage(localize('openNotebookError', 'Open file {0} failed: {1}',
				resource.fsPath,
				e instanceof Error ? e.message : e));
		}
	}

	getTreeItem(element: BookTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: BookTreeItem): Thenable<BookTreeItem[]> {
		if (element) {
			if (element.tableOfContents) {
				return Promise.resolve(this.getSections(element.tableOfContents, element.root));
			} else {
				return Promise.resolve([]);
			}
		} else {
			return Promise.resolve(this.getBooks());
		}
	}

	private getBooks(): BookTreeItem[] {
		let books: BookTreeItem[] = [];
		for (let i in this.tableOfContentsPath) {
			let root = path.dirname(path.dirname(this.tableOfContentsPath[i]));
			try {
				const config = yaml.safeLoad(fs.readFileSync(path.join(root, '_config.yml'), 'utf-8'));
				const tableOfContents = yaml.safeLoad(fs.readFileSync(this.tableOfContentsPath[i], 'utf-8'));
				let book = new BookTreeItem(config.title, root, tableOfContents, vscode.TreeItemCollapsibleState.Collapsed);
				books.push(book);
			} catch (e) {
				vscode.window.showErrorMessage(localize('openConfigFileError', 'Open file {0} failed: {1}',
					path.join(root, '_config.yml'),
					e instanceof Error ? e.message : e));
			}
		}
		return books;
	}

	private getSections(sec: any[], root: string): BookTreeItem[] {
		let notebooks: BookTreeItem[] = [];
		for (let i = 0; i < sec.length; i++) {
			if (sec[i].url) {
				let pathToNotebook = path.join(root, 'content', sec[i].url.concat('.ipynb'));
				let pathToMarkdown = path.join(root, 'content', sec[i].url.concat('.md'));
				// Note: Currently, if there is an ipynb and a md file with the same name, Jupyter Books only shows the notebook.
				// Following Jupyter Books behavior for now
				if (utils.pathExists(pathToNotebook)) {
					let notebook = new BookTreeItem(sec[i].title, root, sec[i].sections, sec[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, sec[i].url, vscode.FileType.File, { command: 'bookTreeView.openNotebook', title: 'Open Notebook', arguments: [pathToNotebook], });
					notebooks.push(notebook);
				} else if (utils.pathExists(pathToMarkdown)) {
					let markdown = new BookTreeItem(sec[i].title, root, sec[i].sections, sec[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, sec[i].url, vscode.FileType.File, { command: 'bookTreeView.openNotebook', title: 'Open Notebook', arguments: [pathToMarkdown], });
					notebooks.push(markdown);
				} else {
					vscode.window.showErrorMessage(localize('missingFileError', 'Missing file : {0}', sec[i].title));
				}
			} else {
				// TODO: search functionality (#6160)
			}
		}
		return notebooks;
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Book } from './bookTreeItem';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();


export class BookTreeViewProvider implements vscode.TreeDataProvider<Book> {

	private _onDidChangeTreeData: vscode.EventEmitter<Book | undefined> = new vscode.EventEmitter<Book | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Book | undefined> = this._onDidChangeTreeData.event;
	private tableOfContentsPath: string[];

	constructor(private workspaceRoot: string) {
		if (workspaceRoot !== '') {
			this.tableOfContentsPath = this.getFiles(this.workspaceRoot, []);
			if (this.tableOfContentsPath === undefined || this.tableOfContentsPath.length === 0) {
				vscode.commands.executeCommand('setContext', 'bookOpened', false);
			} else {
				vscode.commands.executeCommand('setContext', 'bookOpened', true);
			}
		}
	}

	private getFiles(dir: string, allFiles: string[]): string[] {
		let files = fs.readdirSync(dir);
		for (let i in files) {
			let name = path.join(dir, files[i]);
			if (fs.statSync(name).isDirectory()) {
				this.getFiles(name, allFiles);
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
			vscode.window.showErrorMessage(localize('showNotebookError', 'Open file {0} failed: {1}',
				resource.fsPath,
				e instanceof Error ? e.message : e));
		}
	}

	getTreeItem(element: Book): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Book): Thenable<Book[]> {
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

	private getBooks(): Book[] {
		let books: Book[] = [];
		for (let i in this.tableOfContentsPath) {
			let root = path.dirname(path.dirname(this.tableOfContentsPath[i]));
			try {
				const config = yaml.safeLoad(fs.readFileSync(path.join(root, '/_config.yml'), 'utf-8'));
				const tableOfContents = yaml.safeLoad(fs.readFileSync(this.tableOfContentsPath[i], 'utf-8'));
				let book = new Book(config.title, root, tableOfContents, vscode.TreeItemCollapsibleState.Collapsed);
				books.push(book);
			} catch (e) {
				continue;
			}
		}
		return books;
	}

	private getSections(sec: any[], root: string): Book[] {
		let notebooks: Book[] = [];
		for (let i = 0; i < sec.length; i++) {
			if (sec[i].url) {
				let pathToNotebook = path.join(root, 'content', sec[i].url.concat('.ipynb'));
				let pathToMarkdown = path.join(root, 'content', sec[i].url.concat('.md'));
				if (this.pathExists(pathToNotebook)) {
					let notebook = new Book(sec[i].title, root, sec[i].sections, sec[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, sec[i].url, vscode.FileType.File, { command: 'bookTreeView.openNotebook', title: 'Open Notebook', arguments: [pathToNotebook], });
					notebooks.push(notebook);
				} else if (this.pathExists(pathToMarkdown)) {
					let markdown = new Book(sec[i].title, root, sec[i].sections, sec[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, sec[i].url, vscode.FileType.File, { command: 'bookTreeView.openNotebook', title: 'Open Notebook', arguments: [pathToMarkdown], });
					notebooks.push(markdown);
				} else {
					vscode.window.showErrorMessage(localize('missingFileError', 'Missing file : {0}', sec[i].title));
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
		} catch (e) {
			return false;
		}
		return true;
	}
}


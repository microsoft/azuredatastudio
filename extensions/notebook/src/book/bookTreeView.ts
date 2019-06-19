/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Book } from './bookTreeItem';

export class BookTreeViewProvider implements vscode.TreeDataProvider<Book> {

	private _onDidChangeTreeData: vscode.EventEmitter<Book | undefined> = new vscode.EventEmitter<Book | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Book | undefined> = this._onDidChangeTreeData.event;
	private tocPath: string[];

	constructor(private workspaceRoot: string) {
		if (workspaceRoot !== '') {
			this.tocPath = this.getFiles(this.workspaceRoot, []);
			if (this.tocPath === undefined || this.tocPath.length === 0) {
				vscode.commands.executeCommand('setContext', 'bookOpened', false);
			} else {
				vscode.commands.executeCommand('setContext', 'bookOpened', true);
			}
		}
	}

	private getFiles(dir: string, files_: string[]): string[] {
		files_ = files_ || [];
		let files = fs.readdirSync(dir);
		for (let i in files) {
			let name = dir + '/' + files[i];
			if (fs.statSync(name).isDirectory()) {
				this.getFiles(name, files_);
			} else if (files[i] === 'toc.yml') {
				files_.push(name);
			}
		}
		return files_;
	}

	async openNotebook(resource: vscode.Uri): Promise<void> {
		let doc = await vscode.workspace.openTextDocument(resource);
		vscode.window.showTextDocument(doc);
	}

	getTreeItem(element: Book): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Book): Thenable<Book[]> {
		if (element) {
			if (element.toc) {
				return Promise.resolve(this.getSections(element.toc, element.root));
			} else {
				return Promise.resolve([]);
			}
		} else {
			return Promise.resolve(this.getBooks());
		}
	}

	private getBooks(): Book[] {
		let books: Book[] = [];
		for (let i in this.tocPath) {
			let root = this.tocPath[i].substring(0, this.tocPath[i].lastIndexOf('_data/toc.yml'));
			try {
				const config = yaml.safeLoad(fs.readFileSync(root + '/_config.yml', 'utf-8'));
				const toc = yaml.safeLoad(fs.readFileSync(this.tocPath[i], 'utf-8'));
				let book = new Book(config.title, root, toc, vscode.TreeItemCollapsibleState.Expanded);
				/* book.iconPath = {
					light: path.join(__filename, '..', '..', 'resources', 'light', '.svg'),
					dark: path.join(__filename, '..', '..', 'resources', 'dark', '.svg')
				}; */
				books.push(book);
			} catch (e) {
				// TODO: missing _config.yml file
			}
		}
		return books;
	}

	private getSections(sec: any[], root: string): Book[] {
		let notebooks: Book[] = [];

		for (let i = 0; i < sec.length; i++) {
			if (sec[i].url) {

				let pathToNotebook = path.join(root, 'content', String(sec[i].url).concat('.ipynb'));
				let pathToMarkdown = path.join(root, 'content', String(sec[i].url).concat('.md'));

				if (this.pathExists(pathToNotebook)) {
					let notebook = new Book(sec[i].title, root, sec[i].sections, sec[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, sec[i].url, vscode.FileType.File, { command: 'bookTreeView.openNotebook', title: 'Open Notebook', arguments: [pathToNotebook], });
					notebook.iconPath = {
						light: path.join(__filename, '..', '..', 'resources', 'light', 'open_notebook.svg'),
						dark: path.join(__filename, '..', '..', 'resources', 'dark', 'open_notebook_inverse.svg')
					};
					notebooks.push(notebook);
				} else if (this.pathExists(pathToMarkdown)) {
					let markdown = new Book(sec[i].title, root, sec[i].sections, sec[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, sec[i].url, vscode.FileType.File, { command: 'bookTreeView.openNotebook', title: 'Open Notebook', arguments: [pathToMarkdown], });
					// markdown.iconPath = {
					// 	light: path.join(__filename, '..', '..', 'resources', 'light', 'open_notebook.svg'),
					// 	dark: path.join(__filename, '..', '..', 'resources', 'dark', 'open_notebook_inverse.svg')
					// };
					notebooks.push(markdown);
				} else {
					// TODO: missing notebook/markdown file
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


/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { BookTreeItem } from './bookTreeItem';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();


export class BookTreeViewProvider implements vscode.TreeDataProvider<BookTreeItem>, azdata.nb.NavigationProvider {
	readonly providerId: string = 'BookNavigator';

	private _onDidChangeTreeData: vscode.EventEmitter<BookTreeItem | undefined> = new vscode.EventEmitter<BookTreeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<BookTreeItem | undefined> = this._onDidChangeTreeData.event;
	private _tableOfContentsPath: string[];
	private _allNotebooks = new Map<string, BookTreeItem>();

	constructor(private workspaceRoot: string) {
		if (workspaceRoot !== '') {
			this._tableOfContentsPath = this.getTocFiles(this.workspaceRoot);
			let bookOpened: boolean = this._tableOfContentsPath && this._tableOfContentsPath.length > 0;
			vscode.commands.executeCommand('setContext', 'bookOpened', bookOpened);
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

	async openNotebook(resource: string): Promise<void> {
		try {
			let doc = await vscode.workspace.openTextDocument(resource);
			vscode.window.showTextDocument(doc);
		} catch (e) {
			vscode.window.showErrorMessage(localize('openNotebookError', 'Open file {0} failed: {1}',
				resource,
				e instanceof Error ? e.message : e));
		}
	}

	openMarkdown(resource: string): void {
		try {
			vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(resource));
		} catch (e) {
			vscode.window.showErrorMessage(localize('openMarkdownError', 'Open file {0} failed: {1}',
				resource,
				e instanceof Error ? e.message : e));
		}
	}

	openExternalLink(resource: string): void {
		try {
			vscode.env.openExternal(vscode.Uri.parse(resource));
		} catch (e) {
			vscode.window.showErrorMessage(localize('openExternalLinkError', 'Open link {0} failed: {1}',
				resource,
				e instanceof Error ? e.message : e));
		}
	}

	getTreeItem(element: BookTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: BookTreeItem): Thenable<BookTreeItem[]> {
		if (element) {
			if (element.sections) {
				return Promise.resolve(this.getSections(element.tableOfContents, element.sections, element.root));
			} else {
				return Promise.resolve([]);
			}
		} else {
			return Promise.resolve(this.getBooks());
		}
	}

	private flattenArray(array: any[]): any[] {
		return array.reduce((acc, val) => Array.isArray(val.sections) ? acc.concat(val).concat(this.flattenArray(val.sections)) : acc.concat(val), []);
	}

	private getBooks(): BookTreeItem[] {
		let books: BookTreeItem[] = [];
		for (let i in this._tableOfContentsPath) {
			let root = path.dirname(path.dirname(this._tableOfContentsPath[i]));
			try {
				const config = yaml.safeLoad(fs.readFileSync(path.join(root, '_config.yml'), 'utf-8'));
				const tableOfContents = yaml.safeLoad(fs.readFileSync(this._tableOfContentsPath[i], 'utf-8'));
				let book = new BookTreeItem(config.title, root, this.flattenArray(tableOfContents), tableOfContents, 'book');
				books.push(book);
			} catch (e) {
				vscode.window.showErrorMessage(localize('openConfigFileError', 'Open file {0} failed: {1}',
					path.join(root, '_config.yml'),
					e instanceof Error ? e.message : e));
			}
		}
		return books;
	}

	private getSections(tableOfContents: any[], sections: any[], root: string): BookTreeItem[] {
		let notebooks: BookTreeItem[] = [];
		for (let i = 0; i < sections.length; i++) {
			if (sections[i].url) {
				if (sections[i].external) {
					let externalLink = new BookTreeItem(sections[i].title, root, tableOfContents, sections[i], 'externalLink');
					notebooks.push(externalLink);
				} else {
					let pathToNotebook = path.join(root, 'content', sections[i].url.concat('.ipynb'));
					let pathToMarkdown = path.join(root, 'content', sections[i].url.concat('.md'));
					// Note: Currently, if there is an ipynb and a md file with the same name, Jupyter Books only shows the notebook.
					// Following Jupyter Books behavior for now
					if (fs.existsSync(pathToNotebook)) {
						let notebook = new BookTreeItem(sections[i].title, root, tableOfContents, sections[i], 'notebook');
						notebooks.push(notebook);
						this._allNotebooks.set(pathToNotebook, notebook);
					} else if (fs.existsSync(pathToMarkdown)) {
						let markdown = new BookTreeItem(sections[i].title, root, tableOfContents, sections[i], 'markdown');
						notebooks.push(markdown);
					} else {
						vscode.window.showErrorMessage(localize('missingFileError', 'Missing file : {0}', sections[i].title));
					}
				}
			} else {
				// TODO: search functionality (#6160)
			}
		}
		return notebooks;
	}

	getNavigation(uri: vscode.Uri): Thenable<azdata.nb.NavigationResult> {
		let notebook = this._allNotebooks.get(uri.fsPath);
		let result: azdata.nb.NavigationResult;
		if (notebook) {
			result = {
				hasNavigation: true,
				previous: notebook.previousUri ? vscode.Uri.file(notebook.previousUri) : undefined,
				next: notebook.nextUri ? vscode.Uri.file(notebook.nextUri) : undefined
			};
		} else {
			result = {
				hasNavigation: false,
				previous: undefined,
				next: undefined
			};
		}
		return Promise.resolve(result);
	}

}
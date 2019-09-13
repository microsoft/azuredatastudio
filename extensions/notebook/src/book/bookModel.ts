/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as glob from 'fast-glob';
import { BookTreeItem, BookTreeItemType } from './bookTreeItem';
import { maxBookSearchDepth, notebookConfigKey } from '../common/constants';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();
//const exists = promisify(fs.exists);

export class BookModel implements azdata.nb.NavigationProvider {
	public BookPath: string;
	private _books: BookTreeItem[] = [];
	private _allNotebooks = new Map<string, BookTreeItem>();
	public openAsUntitled: boolean = false;
	private _extensionContext: vscode.ExtensionContext;
	private _tableOfContentPaths: string[] = [];
	readonly providerId: string = 'BookNavigator';
	// For testing
	private _errorMessage: string;

	constructor(bookPath: string, openAsUntitled: boolean, extensionContext: vscode.ExtensionContext) {
		this.BookPath = bookPath;
		this.openAsUntitled = openAsUntitled;
		this._extensionContext = extensionContext;
		extensionContext.subscriptions.push(azdata.nb.registerNavigationProvider(this));
		//this.getTableOfContentFiles(this.BookPath).then(() => { this._books = this.readBooks();}, (err) => { console.log(err); });

	}

	public async initializeContents(): Promise<void> {
		await this.getTableOfContentFiles(this.BookPath);
		this.readBooks();
		return;
	}

	public getAllBooks(): Map<string, BookTreeItem> {
		return this._allNotebooks;
	}

	async getTableOfContentFiles(workspacePath: string): Promise<void> {
		try {
			let notebookConfig = vscode.workspace.getConfiguration(notebookConfigKey);
			let maxDepth = notebookConfig[maxBookSearchDepth];
			// Use default value if user enters an invalid value
			if (maxDepth === undefined || maxDepth < 0) {
				maxDepth = 5;
			} else if (maxDepth === 0) { // No limit of search depth if user enters 0
				maxDepth = undefined;
			}

			let p = path.join(workspacePath, '**', '_data', 'toc.yml').replace(/\\/g, '/');
			let tableOfContentPaths = await glob(p, { deep: maxDepth });
			this._tableOfContentPaths = this._tableOfContentPaths.concat(tableOfContentPaths);
			let bookOpened: boolean = this._tableOfContentPaths.length > 0;
			vscode.commands.executeCommand('setContext', 'bookOpened', bookOpened);
		} catch (error) {
			console.log(error);
		}
	}

	private flattenArray(array: any[], title: string): any[] {
		try {
			return array.reduce((acc, val) => Array.isArray(val.sections) ? acc.concat(val).concat(this.flattenArray(val.sections, title)) : acc.concat(val), []);
		} catch (e) {
			throw localize('Invalid toc.yml', 'Error: {0} has an incorrect toc.yml file', title);
		}
	}

	private readBooks(): BookTreeItem[] {
		for (const contentPath of this._tableOfContentPaths) {
			let root = path.dirname(path.dirname(contentPath));
			try {
				const config = yaml.safeLoad(fs.readFileSync(path.join(root, '_config.yml'), 'utf-8'));
				const tableOfContents = yaml.safeLoad(fs.readFileSync(contentPath, 'utf-8'));
				let book = new BookTreeItem({
					title: config.title,
					root: root,
					tableOfContents: this.flattenArray(tableOfContents, config.title),
					page: tableOfContents,
					type: BookTreeItemType.Book,
					treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Expanded,
					untitled: this.openAsUntitled,
				},
					{
						light: this._extensionContext.asAbsolutePath('resources/light/book.svg'),
						dark: this._extensionContext.asAbsolutePath('resources/dark/book_inverse.svg')
					}
				);
				this._books.push(book);
			} catch (e) {
				let error = e instanceof Error ? e.message : e;
				this._errorMessage = error;
				vscode.window.showErrorMessage(error);
			}
		}
		return this._books;
	}

	public getBooks(): BookTreeItem[] {
		if (this._books.length > 0) {
			return this._books;
		} else {
			return [];
		}
	}

	public getSections(tableOfContents: any[], sections: any[], root: string): BookTreeItem[] {
		let notebooks: BookTreeItem[] = [];
		for (let i = 0; i < sections.length; i++) {
			if (sections[i].url) {
				if (sections[i].external) {
					let externalLink = new BookTreeItem({
						title: sections[i].title,
						root: root,
						tableOfContents: tableOfContents,
						page: sections[i],
						type: BookTreeItemType.ExternalLink,
						treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
						untitled: this.openAsUntitled
					},
						{
							light: this._extensionContext.asAbsolutePath('resources/light/link.svg'),
							dark: this._extensionContext.asAbsolutePath('resources/dark/link_inverse.svg')
						}
					);

					notebooks.push(externalLink);
				} else {
					let pathToNotebook = path.join(root, 'content', sections[i].url.concat('.ipynb'));
					let pathToMarkdown = path.join(root, 'content', sections[i].url.concat('.md'));
					// Note: Currently, if there is an ipynb and a md file with the same name, Jupyter Books only shows the notebook.
					// Following Jupyter Books behavior for now
					if (fs.existsSync(pathToNotebook)) {
						let notebook = new BookTreeItem({
							title: sections[i].title,
							root: root,
							tableOfContents: tableOfContents,
							page: sections[i],
							type: BookTreeItemType.Notebook,
							treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
							untitled: this.openAsUntitled
						},
							{
								light: this._extensionContext.asAbsolutePath('resources/light/notebook.svg'),
								dark: this._extensionContext.asAbsolutePath('resources/dark/notebook_inverse.svg')
							}
						);
						notebooks.push(notebook);
						if (this.openAsUntitled) {
							this._allNotebooks.set(path.basename(pathToNotebook), notebook);
						}
						else {
							this._allNotebooks.set(pathToNotebook, notebook);
						}
					} else if (fs.existsSync(pathToMarkdown)) {
						let markdown = new BookTreeItem({
							title: sections[i].title,
							root: root,
							tableOfContents: tableOfContents,
							page: sections[i],
							type: BookTreeItemType.Markdown,
							treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
							untitled: this.openAsUntitled
						},
							{
								light: this._extensionContext.asAbsolutePath('resources/light/markdown.svg'),
								dark: this._extensionContext.asAbsolutePath('resources/dark/markdown_inverse.svg')
							}
						);
						notebooks.push(markdown);
					} else {
						let error = localize('missingFileError', 'Missing file : {0}', sections[i].title);
						this._errorMessage = error;
						vscode.window.showErrorMessage(error);
					}
				}
			} else {
				// TODO: search functionality (#6160)
			}
		}
		return notebooks;
	}

	public get errorMessage() {
		return this._errorMessage;
	}

	public get tableOfContentPaths() {
		return this._tableOfContentPaths;
	}

	getNavigation(uri: vscode.Uri): Thenable<azdata.nb.NavigationResult> {
		let notebook = !this.openAsUntitled ? this._allNotebooks.get(uri.fsPath) : this._allNotebooks.get(path.basename(uri.fsPath));
		let result: azdata.nb.NavigationResult;
		if (notebook) {
			result = {
				hasNavigation: true,
				previous: notebook.previousUri ? this.openAsUntitled ? vscode.Uri.parse(notebook.previousUri).with({ scheme: 'untitled' }) : vscode.Uri.file(notebook.previousUri) : undefined,
				next: notebook.nextUri ? this.openAsUntitled ? vscode.Uri.parse(notebook.nextUri).with({ scheme: 'untitled' }) : vscode.Uri.file(notebook.nextUri) : undefined
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as glob from 'fast-glob';
import { BookTreeItem, BookTreeItemType } from './bookTreeItem';
import { maxBookSearchDepth, notebookConfigKey } from '../common/constants';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class BookTreeViewProvider implements vscode.TreeDataProvider<BookTreeItem>, azdata.nb.NavigationProvider {
	readonly providerId: string = 'BookNavigator';

	private _onDidChangeTreeData: vscode.EventEmitter<BookTreeItem | undefined> = new vscode.EventEmitter<BookTreeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<BookTreeItem | undefined> = this._onDidChangeTreeData.event;
	private _tableOfContentPaths: string[] = [];
	private _allNotebooks = new Map<string, BookTreeItem>();
	private _extensionContext: vscode.ExtensionContext;
	private _throttleTimer: any;
	private _resource: string;

	constructor(workspaceFolders: vscode.WorkspaceFolder[], extensionContext: vscode.ExtensionContext) {
		this.getTableOfContentFiles(workspaceFolders).then(() => undefined, (err) => { console.log(err); });
		this._extensionContext = extensionContext;
	}

	async getTableOfContentFiles(workspaceFolders: vscode.WorkspaceFolder[]): Promise<void> {
		let notebookConfig = vscode.workspace.getConfiguration(notebookConfigKey);
		let maxDepth = notebookConfig[maxBookSearchDepth];
		// Use default value if user enters an invalid value
		if (maxDepth === undefined || maxDepth < 0) {
			maxDepth = 5;
		} else if (maxDepth === 0) { // No limit of search depth if user enters 0
			maxDepth = undefined;
		}
		let workspacePaths: string[] = workspaceFolders.map(a => a.uri.fsPath);
		for (let path of workspacePaths) {
			let tableOfContentPaths = await glob([path + '/**/_data/toc.yml'], { deep: maxDepth });
			this._tableOfContentPaths = this._tableOfContentPaths.concat(tableOfContentPaths);
		}
		let bookOpened: boolean = this._tableOfContentPaths.length > 0;
		vscode.commands.executeCommand('setContext', 'bookOpened', bookOpened);
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
		this.runThrottledAction(resource, () => {
			try {
				vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(resource));
			} catch (e) {
				vscode.window.showErrorMessage(localize('openMarkdownError', "Open file {0} failed: {1}",
					resource,
					e instanceof Error ? e.message : e));
			}
		});
	}

	private runThrottledAction(resource: string, action: () => void) {
		const isResourceChange = resource !== this._resource;
		if (isResourceChange) {
			clearTimeout(this._throttleTimer);
			this._throttleTimer = undefined;
		}

		this._resource = resource;

		// Schedule update if none is pending
		if (!this._throttleTimer) {
			if (isResourceChange) {
				action();
			} else {
				this._throttleTimer = setTimeout(() => action(), 300);
			}
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

	public getBooks(): BookTreeItem[] {
		let books: BookTreeItem[] = [];
		for (let i in this._tableOfContentPaths) {
			let root = path.dirname(path.dirname(this._tableOfContentPaths[i]));
			try {
				const config = yaml.safeLoad(fs.readFileSync(path.join(root, '_config.yml'), 'utf-8'));
				const tableOfContents = yaml.safeLoad(fs.readFileSync(this._tableOfContentPaths[i], 'utf-8'));
				let book = new BookTreeItem({
					title: config.title,
					root: root,
					tableOfContents: this.flattenArray(tableOfContents),
					page: tableOfContents,
					type: BookTreeItemType.Book
				},
					{
						light: this._extensionContext.asAbsolutePath('resources/light/book.svg'),
						dark: this._extensionContext.asAbsolutePath('resources/dark/book_inverse.svg')
					}
				);
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
					let externalLink = new BookTreeItem({
						title: sections[i].title,
						root: root,
						tableOfContents: tableOfContents,
						page: sections[i],
						type: BookTreeItemType.ExternalLink
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
							type: BookTreeItemType.Notebook
						},
							{
								light: this._extensionContext.asAbsolutePath('resources/light/notebook.svg'),
								dark: this._extensionContext.asAbsolutePath('resources/dark/notebook_inverse.svg')
							}
						);
						notebooks.push(notebook);
						this._allNotebooks.set(pathToNotebook, notebook);
					} else if (fs.existsSync(pathToMarkdown)) {
						let markdown = new BookTreeItem({
							title: sections[i].title,
							root: root,
							tableOfContents: tableOfContents,
							page: sections[i],
							type: BookTreeItemType.Markdown
						},
							{
								light: this._extensionContext.asAbsolutePath('resources/light/markdown.svg'),
								dark: this._extensionContext.asAbsolutePath('resources/dark/markdown_inverse.svg')
							}
						);
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

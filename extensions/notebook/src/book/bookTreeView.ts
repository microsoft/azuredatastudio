/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import * as glob from 'fast-glob';
import { BookTreeItem, BookTreeItemType } from './bookTreeItem';
import { maxBookSearchDepth, notebookConfigKey } from '../common/constants';
import { isEditorTitleFree, exists } from '../common/utils';
import * as nls from 'vscode-nls';
import { IJupyterBookToc, IJupyterBookSection } from '../contracts/content';

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
	// For testing
	private _errorMessage: string;
	private _onReadAllTOCFiles: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	private _openAsUntitled: boolean;

	constructor(workspaceFolders: vscode.WorkspaceFolder[], extensionContext: vscode.ExtensionContext) {
		this.initialize(workspaceFolders, null, extensionContext);
	}

	private initialize(workspaceFolders: vscode.WorkspaceFolder[], bookPath: string, context: vscode.ExtensionContext): void {
		let workspacePaths: string[] = [];
		if (bookPath) {
			workspacePaths.push(bookPath);
		}
		else if (workspaceFolders) {
			workspacePaths = workspaceFolders.map(a => a.uri.fsPath);
		}
		this.getTableOfContentFiles(workspacePaths).then(() => undefined, (err) => { console.log(err); });
		this._extensionContext = context;
	}

	public get onReadAllTOCFiles(): vscode.Event<void> {
		return this._onReadAllTOCFiles.event;
	}

	async getTableOfContentFiles(workspacePaths: string[]): Promise<void> {
		let notebookConfig = vscode.workspace.getConfiguration(notebookConfigKey);
		let maxDepth = notebookConfig[maxBookSearchDepth];
		// Use default value if user enters an invalid value
		if (maxDepth === undefined || maxDepth < 0) {
			maxDepth = 5;
		} else if (maxDepth === 0) { // No limit of search depth if user enters 0
			maxDepth = undefined;
		}
		for (let workspacePath of workspacePaths) {
			let p = path.join(workspacePath, '**', '_data', 'toc.yml').replace(/\\/g, '/');
			let tableOfContentPaths = await glob(p, { deep: maxDepth });
			this._tableOfContentPaths = this._tableOfContentPaths.concat(tableOfContentPaths);
		}
		let bookOpened: boolean = this._tableOfContentPaths.length > 0;
		vscode.commands.executeCommand('setContext', 'bookOpened', bookOpened);
		this._onReadAllTOCFiles.fire();
	}

	async openBook(bookPath: string, openAsUntitled: boolean, urlToOpen?: string): Promise<void> {
		try {
			// Check if the book is already open in viewlet.
			if (this._tableOfContentPaths.indexOf(path.join(bookPath, '_data', 'toc.yml').replace(/\\/g, '/')) > -1 && this._allNotebooks.size > 0) {
				vscode.commands.executeCommand('workbench.books.action.focusBooksExplorer');
			}
			else {
				await this.getTableOfContentFiles([bookPath]);
				const bookViewer = vscode.window.createTreeView('bookTreeView', { showCollapseAll: true, treeDataProvider: this });
				await vscode.commands.executeCommand('workbench.books.action.focusBooksExplorer');
				this._openAsUntitled = openAsUntitled;
				let books = await this.getBooks();
				if (books && books.length > 0) {
					const rootTreeItem = books[0];
					const sectionToOpen = rootTreeItem.findChildSection(urlToOpen);
					bookViewer.reveal(rootTreeItem, { expand: vscode.TreeItemCollapsibleState.Expanded, focus: true, select: true });
					const urlPath = sectionToOpen ? sectionToOpen.url : rootTreeItem.tableOfContents.sections[0].url;
					const sectionToOpenMarkdown: string = path.join(bookPath, 'content', urlPath.concat('.md'));
					const sectionToOpenNotebook: string = path.join(bookPath, 'content', urlPath.concat('.ipynb'));
					const markdownExists = await exists(sectionToOpenMarkdown);
					const notebookExists = await exists(sectionToOpenNotebook);
					if (markdownExists) {
						vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(sectionToOpenMarkdown));
					}
					else if (notebookExists) {
						this.openNotebook(sectionToOpenNotebook);
					}
				}
			}
		} catch (e) {
			vscode.window.showErrorMessage(localize('openBookError', "Open book {0} failed: {1}",
				bookPath,
				e instanceof Error ? e.message : e));
		}
	}

	async openNotebook(resource: string): Promise<void> {
		try {
			if (this._openAsUntitled) {
				this.openNotebookAsUntitled(resource);
			}
			else {
				let doc = await vscode.workspace.openTextDocument(resource);
				vscode.window.showTextDocument(doc);
			}
		} catch (e) {
			vscode.window.showErrorMessage(localize('openNotebookError', "Open file {0} failed: {1}",
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

	openNotebookAsUntitled(resource: string): void {
		try {
			let untitledFileName: vscode.Uri = this.getUntitledNotebookUri(resource);
			vscode.workspace.openTextDocument(resource).then((document) => {
				let initialContent = document.getText();
				azdata.nb.showNotebookDocument(untitledFileName, {
					connectionProfile: null,
					initialContent: initialContent,
					initialDirtyState: false
				});
			});
		} catch (e) {
			vscode.window.showErrorMessage(localize('openUntitledNotebookError', "Open file {0} as untitled failed: {1}",
				resource,
				e instanceof Error ? e.message : e));
		}
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
			vscode.window.showErrorMessage(localize('openExternalLinkError', "Open link {0} failed: {1}",
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

	/**
	 * Recursively parses out a section of a Jupyter Book.
	 * @param array The input data to parse
	 */
	private parseJupyterSection(array: any[]): IJupyterBookSection[] {
		return array.reduce((acc, val) => Array.isArray(val.sections) ? acc.concat(val).concat(this.parseJupyterSection(val.sections)) : acc.concat(val), []);
	}

	public async getBooks(): Promise<BookTreeItem[]> {
		let books: BookTreeItem[] = [];
		for (const contentPath of this._tableOfContentPaths) {
			let root = path.dirname(path.dirname(contentPath));
			try {
				const config = yaml.safeLoad((await fs.readFile(path.join(root, '_config.yml'), 'utf-8')).toString());
				const tableOfContents = yaml.safeLoad((await fs.readFile(contentPath, 'utf-8')).toString());
				try {
					let book = new BookTreeItem({
						title: config.title,
						root: root,
						tableOfContents: { sections: this.parseJupyterSection(tableOfContents) },
						page: tableOfContents,
						type: BookTreeItemType.Book,
						treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Expanded,
					},
						{
							light: this._extensionContext.asAbsolutePath('resources/light/book.svg'),
							dark: this._extensionContext.asAbsolutePath('resources/dark/book_inverse.svg')
						}
					);
					books.push(book);
				} catch (e) {
					throw Error(localize('invalidTocError', "Error: {0} has an incorrect toc.yml file. {1}", config.title, e instanceof Error ? e.message : e));
				}
			} catch (e) {
				let error = e instanceof Error ? e.message : e;
				this._errorMessage = error;
				vscode.window.showErrorMessage(error);
			}
		}
		return books;
	}

	public async getSections(tableOfContents: IJupyterBookToc, sections: IJupyterBookSection[], root: string): Promise<BookTreeItem[]> {
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
						treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed
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
					if (await exists(pathToNotebook)) {
						let notebook = new BookTreeItem({
							title: sections[i].title,
							root: root,
							tableOfContents: tableOfContents,
							page: sections[i],
							type: BookTreeItemType.Notebook,
							treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed
						},
							{
								light: this._extensionContext.asAbsolutePath('resources/light/notebook.svg'),
								dark: this._extensionContext.asAbsolutePath('resources/dark/notebook_inverse.svg')
							}
						);
						notebooks.push(notebook);
						this._allNotebooks.set(pathToNotebook, notebook);
						if (this._openAsUntitled) {
							this._allNotebooks.set(path.basename(pathToNotebook), notebook);
						}
					} else if (await exists(pathToMarkdown)) {
						let markdown = new BookTreeItem({
							title: sections[i].title,
							root: root,
							tableOfContents: tableOfContents,
							page: sections[i],
							type: BookTreeItemType.Markdown,
							treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed
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

	getNavigation(uri: vscode.Uri): Thenable<azdata.nb.NavigationResult> {
		let notebook = uri.scheme !== 'untitled' ? this._allNotebooks.get(uri.fsPath) : this._allNotebooks.get(path.basename(uri.fsPath));
		let result: azdata.nb.NavigationResult;
		if (notebook) {
			result = {
				hasNavigation: true,
				previous: notebook.previousUri ? this._openAsUntitled ? vscode.Uri.parse(notebook.previousUri).with({ scheme: 'untitled' }) : vscode.Uri.file(notebook.previousUri) : undefined,
				next: notebook.nextUri ? this._openAsUntitled ? vscode.Uri.parse(notebook.nextUri).with({ scheme: 'untitled' }) : vscode.Uri.file(notebook.nextUri) : undefined
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

	public get errorMessage() {
		return this._errorMessage;
	}

	public get tableOfContentPaths() {
		return this._tableOfContentPaths;
	}

	getUntitledNotebookUri(resource: string): vscode.Uri {
		let untitledFileName: vscode.Uri;
		if (process.platform.indexOf('win') > -1) {
			let title = path.join(path.dirname(resource), this.findNextUntitledFileName(resource));
			untitledFileName = vscode.Uri.parse(`untitled:${title}`);
		}
		else {
			untitledFileName = vscode.Uri.parse(resource).with({ scheme: 'untitled' });
		}
		if (!this._allNotebooks.get(untitledFileName.fsPath) && !this._allNotebooks.get(path.basename(untitledFileName.fsPath))) {
			let notebook = this._allNotebooks.get(resource);
			this._allNotebooks.set(path.basename(untitledFileName.fsPath), notebook);
		}
		return untitledFileName;
	}

	findNextUntitledFileName(filePath: string): string {
		const baseName = path.basename(filePath);
		let idx = 0;
		let title = `${baseName}`;
		do {
			const suffix = idx === 0 ? '' : `-${idx}`;
			title = `${baseName}${suffix}`;
			idx++;
		} while (!isEditorTitleFree(title));

		return title;
	}

}

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
import * as fileServices from 'fs';
import * as fs from 'fs-extra';
import * as loc from '../common/localizedConstants';
import { IJupyterBookToc, IJupyterBookSection } from '../contracts/content';
import { isNullOrUndefined } from 'util';
import { ApiWrapper } from '../common/apiWrapper';


const fsPromises = fileServices.promises;

export class BookModel implements azdata.nb.NavigationProvider {
	private _bookItems: BookTreeItem[];
	private _allNotebooks = new Map<string, BookTreeItem>();
	private _tableOfContentPaths: string[] = [];
	readonly providerId: string = 'BookNavigator';

	private _errorMessage: string;
	private apiWrapper: ApiWrapper = new ApiWrapper();

	constructor(public bookPath: string, public openAsUntitled: boolean, private _extensionContext: vscode.ExtensionContext) {
		this.bookPath = bookPath;
		this.openAsUntitled = openAsUntitled;
		this._bookItems = [];
		this._extensionContext.subscriptions.push(azdata.nb.registerNavigationProvider(this));
	}

	public async initializeContents(): Promise<void> {
		this._tableOfContentPaths = [];
		this._bookItems = [];
		await this.getTableOfContentFiles(this.bookPath);
		await this.readBooks();
	}

	public getAllNotebooks(): Map<string, BookTreeItem> {
		return this._allNotebooks;
	}

	public getNotebook(uri: string): BookTreeItem | undefined {
		return this._allNotebooks.get(uri);
	}

	public async getTableOfContentFiles(folderPath: string): Promise<void> {
		let notebookConfig = vscode.workspace.getConfiguration(notebookConfigKey);
		let maxDepth = notebookConfig[maxBookSearchDepth];
		// Use default value if user enters an invalid value
		if (isNullOrUndefined(maxDepth) || maxDepth < 0) {
			maxDepth = 5;
		} else if (maxDepth === 0) { // No limit of search depth if user enters 0
			maxDepth = undefined;
		}

		let p: string = path.join(folderPath, '**', '_data', 'toc.yml').replace(/\\/g, '/');
		let tableOfContentPaths: string[] = await glob(p, { deep: maxDepth });
		if (tableOfContentPaths.length > 0) {
			this._tableOfContentPaths = this._tableOfContentPaths.concat(tableOfContentPaths);
			vscode.commands.executeCommand('setContext', 'bookOpened', true);
		} else {
			this._errorMessage = loc.missingTocError;
			throw new Error(loc.missingTocError);
		}
	}

	public async readBooks(): Promise<BookTreeItem[]> {
		for (const contentPath of this._tableOfContentPaths) {
			let root: string = path.dirname(path.dirname(contentPath));
			try {
				let fileContents = await fsPromises.readFile(path.join(root, '_config.yml'), 'utf-8');
				const config = yaml.safeLoad(fileContents.toString());
				fileContents = await fsPromises.readFile(contentPath, 'utf-8');
				const tableOfContents: any = yaml.safeLoad(fileContents.toString());
				let book: BookTreeItem = new BookTreeItem({
					title: config.title,
					root: root,
					tableOfContents: { sections: this.parseJupyterSections(tableOfContents) },
					page: tableOfContents,
					type: BookTreeItemType.Book,
					treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Expanded,
					isUntitled: this.openAsUntitled,
				},
					{
						light: this._extensionContext.asAbsolutePath('resources/light/book.svg'),
						dark: this._extensionContext.asAbsolutePath('resources/dark/book_inverse.svg')
					}
				);
				this._bookItems.push(book);
			} catch (e) {
				this._errorMessage = loc.readBookError(this.bookPath, e instanceof Error ? e.message : e);
				this.apiWrapper.showErrorMessage(this._errorMessage);
			}
		}
		return this._bookItems;
	}

	public get bookItems(): BookTreeItem[] {
		return this._bookItems;
	}

	public async getSections(tableOfContents: IJupyterBookToc, sections: IJupyterBookSection[], root: string): Promise<BookTreeItem[]> {
		let notebooks: BookTreeItem[] = [];
		for (let i = 0; i < sections.length; i++) {
			if (sections[i].url) {
				if (sections[i].external) {
					let externalLink: BookTreeItem = new BookTreeItem({
						title: sections[i].title,
						root: root,
						tableOfContents: tableOfContents,
						page: sections[i],
						type: BookTreeItemType.ExternalLink,
						treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
						isUntitled: this.openAsUntitled
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
					if (await fs.pathExists(pathToNotebook)) {
						let notebook = new BookTreeItem({
							title: sections[i].title,
							root: root,
							tableOfContents: tableOfContents,
							page: sections[i],
							type: BookTreeItemType.Notebook,
							treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
							isUntitled: this.openAsUntitled
						},
							{
								light: this._extensionContext.asAbsolutePath('resources/light/notebook.svg'),
								dark: this._extensionContext.asAbsolutePath('resources/dark/notebook_inverse.svg')
							}
						);

						if (this.openAsUntitled) {
							if (!this._allNotebooks.get(path.basename(pathToNotebook))) {
								this._allNotebooks.set(path.basename(pathToNotebook), notebook);
								notebooks.push(notebook);
							}
						} else {
							// convert to URI to avoid casing issue with drive letters when getting navigation links
							let uriToNotebook: vscode.Uri = vscode.Uri.file(pathToNotebook);
							if (!this._allNotebooks.get(uriToNotebook.fsPath)) {
								this._allNotebooks.set(uriToNotebook.fsPath, notebook);
							}
							notebooks.push(notebook);
						}
					} else if (await fs.pathExists(pathToMarkdown)) {
						let markdown: BookTreeItem = new BookTreeItem({
							title: sections[i].title,
							root: root,
							tableOfContents: tableOfContents,
							page: sections[i],
							type: BookTreeItemType.Markdown,
							treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
							isUntitled: this.openAsUntitled
						},
							{
								light: this._extensionContext.asAbsolutePath('resources/light/markdown.svg'),
								dark: this._extensionContext.asAbsolutePath('resources/dark/markdown_inverse.svg')
							}
						);
						notebooks.push(markdown);
					} else {
						this._errorMessage = loc.missingFileError(sections[i].title);
						this.apiWrapper.showErrorMessage(this._errorMessage);
					}
				}
			} else {
				// TODO: search functionality (#6160)
			}
		}
		return notebooks;
	}

	/**
	 * Recursively parses out a section of a Jupyter Book.
	 * @param section The input data to parse
	 */
	private parseJupyterSections(section: any[]): IJupyterBookSection[] {
		try {
			return section.reduce((acc, val) => Array.isArray(val.sections) ?
				acc.concat(val).concat(this.parseJupyterSections(val.sections)) : acc.concat(val), []);
		} catch (e) {
			this._errorMessage = loc.invalidTocFileError();
			if (section.length > 0) {
				this._errorMessage = loc.invalidTocError(section[0].title);
			}
			throw this._errorMessage;
		}

	}

	public get tableOfContentPaths(): string[] {
		return this._tableOfContentPaths;
	}

	getNavigation(uri: vscode.Uri): Thenable<azdata.nb.NavigationResult> {
		let notebook = !this.openAsUntitled ? this._allNotebooks.get(uri.fsPath) : this._allNotebooks.get(path.basename(uri.fsPath));
		let result: azdata.nb.NavigationResult;
		if (notebook) {
			result = {
				hasNavigation: true,
				previous: notebook.previousUri ?
					this.openAsUntitled ? this.getUntitledUri(notebook.previousUri) : vscode.Uri.file(notebook.previousUri) : undefined,
				next: notebook.nextUri ? this.openAsUntitled ? this.getUntitledUri(notebook.nextUri) : vscode.Uri.file(notebook.nextUri) : undefined
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

	getUntitledUri(resource: string): vscode.Uri {
		return vscode.Uri.parse(`untitled:${resource}`);
	}

	public get errorMessage(): string {
		return this._errorMessage;
	}

}

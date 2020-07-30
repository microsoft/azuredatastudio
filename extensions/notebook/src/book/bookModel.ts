/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { BookTreeItem, BookTreeItemType } from './bookTreeItem';
import * as constants from '../common/constants';
import * as path from 'path';
import * as fileServices from 'fs';
import * as fs from 'fs-extra';
import * as loc from '../common/localizedConstants';
import { IJupyterBookToc, IJupyterBookSection } from '../contracts/content';


const fsPromises = fileServices.promises;

export class BookModel {
	private _bookItems: BookTreeItem[];
	private _allNotebooks = new Map<string, BookTreeItem>();
	private _tableOfContentsPath: string;

	private _errorMessage: string;

	constructor(
		public readonly bookPath: string,
		public readonly openAsUntitled: boolean,
		public readonly isNotebook: boolean,
		private _extensionContext: vscode.ExtensionContext) {
		this._bookItems = [];
	}

	public async initializeContents(): Promise<void> {
		this._bookItems = [];
		this._allNotebooks = new Map<string, BookTreeItem>();
		if (this.isNotebook) {
			this.readNotebook();
		} else {
			await this.loadTableOfContentFiles(this.bookPath);
			await this.readBooks();
		}
	}

	public getAllNotebooks(): Map<string, BookTreeItem> {
		return this._allNotebooks;
	}

	public getNotebook(uri: string): BookTreeItem | undefined {
		return this._allNotebooks.get(this.openAsUntitled ? path.basename(uri) : uri);
	}

	public async loadTableOfContentFiles(folderPath: string): Promise<void> {
		if (this.isNotebook) {
			return;
		}

		let tableOfContentsPath: string = path.posix.join(folderPath, '_data', 'toc.yml');
		if (await fs.pathExists(tableOfContentsPath)) {
			this._tableOfContentsPath = tableOfContentsPath;
			vscode.commands.executeCommand('setContext', 'bookOpened', true);
		} else {
			this._errorMessage = loc.missingTocError;
			throw new Error(loc.missingTocError);
		}
	}

	public readNotebook(): BookTreeItem {
		if (!this.isNotebook) {
			return undefined;
		}

		let pathDetails = path.parse(this.bookPath);
		let notebookItem = new BookTreeItem({
			title: pathDetails.name,
			contentPath: this.bookPath,
			root: pathDetails.dir,
			tableOfContents: { sections: undefined },
			page: { sections: undefined },
			type: BookTreeItemType.Notebook,
			treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Expanded,
			isUntitled: this.openAsUntitled,
		},
			{
				light: this._extensionContext.asAbsolutePath('resources/light/notebook.svg'),
				dark: this._extensionContext.asAbsolutePath('resources/dark/notebook_inverse.svg')
			}
		);
		this._bookItems.push(notebookItem);
		if (this.openAsUntitled && !this._allNotebooks.get(pathDetails.base)) {
			this._allNotebooks.set(pathDetails.base, notebookItem);
		} else {
			// convert to URI to avoid casing issue with drive letters when getting navigation links
			let uriToNotebook: vscode.Uri = vscode.Uri.file(this.bookPath);
			if (!this._allNotebooks.get(uriToNotebook.fsPath)) {
				this._allNotebooks.set(uriToNotebook.fsPath, notebookItem);
			}
		}
		return notebookItem;
	}

	public async readBooks(): Promise<BookTreeItem[]> {
		if (this.isNotebook) {
			return undefined;
		}
		let notebookConfig = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		let collapsedItems = notebookConfig[constants.collapseBookItems];
		let collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
		if (collapsedItems) {
			collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
		}

		if (this._tableOfContentsPath) {
			let root: string = path.dirname(path.dirname(this._tableOfContentsPath));
			try {
				let fileContents = await fsPromises.readFile(path.join(root, '_config.yml'), 'utf-8');
				const config = yaml.safeLoad(fileContents.toString());
				fileContents = await fsPromises.readFile(this._tableOfContentsPath, 'utf-8');
				const tableOfContents: any = yaml.safeLoad(fileContents.toString());
				let book: BookTreeItem = new BookTreeItem({
					title: config.title,
					contentPath: this._tableOfContentsPath,
					root: root,
					tableOfContents: { sections: this.parseJupyterSections(tableOfContents) },
					page: tableOfContents,
					type: BookTreeItemType.Book,
					treeItemCollapsibleState: collapsibleState,
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
				vscode.window.showErrorMessage(this._errorMessage);
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
						contentPath: undefined,
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
							contentPath: pathToNotebook,
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
							}
							notebooks.push(notebook);
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
							contentPath: pathToMarkdown,
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
						vscode.window.showErrorMessage(this._errorMessage);
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

	public get tableOfContentsPath(): string {
		return this._tableOfContentsPath;
	}

	public get errorMessage(): string {
		return this._errorMessage;
	}

}

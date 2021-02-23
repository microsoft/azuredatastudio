/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { BookTreeItem, BookTreeItemType, BookTreeItemFormat } from './bookTreeItem';
import * as constants from '../common/constants';
import * as path from 'path';
import * as fileServices from 'fs';
import * as fs from 'fs-extra';
import * as loc from '../common/localizedConstants';
import { IJupyterBookToc, JupyterBookSection } from '../contracts/content';
import { convertFrom, getContentPath, BookVersion } from './bookVersionHandler';
import { debounce } from '../common/utils';
const fsPromises = fileServices.promises;
const content = 'content';

export class BookModel {
	private _bookItems: BookTreeItem[];
	private _allNotebooks = new Map<string, BookTreeItem>();
	private _tableOfContentsPath: string;
	private _contentFolderPath: string;
	private _configPath: string;
	private _bookVersion: BookVersion;
	private _rootPath: string;
	private _errorMessage: string;

	constructor(
		public readonly bookPath: string,
		public readonly openAsUntitled: boolean,
		public readonly isNotebook: boolean,
		private _extensionContext: vscode.ExtensionContext,
		private _onDidChangeTreeData: vscode.EventEmitter<BookTreeItem | undefined>,
		public readonly notebookRootPath?: string) {
		this._bookItems = [];
	}

	public unwatchTOC(): void {
		fs.unwatchFile(this.tableOfContentsPath);
	}

	public watchTOC(): void {
		fs.watchFile(this.tableOfContentsPath, async (curr, prev) => {
			if (curr.mtime > prev.mtime) {
				this.reinitializeContents();
			}
		});
	}

	@debounce(1500)
	public async reinitializeContents(): Promise<void> {
		await this.initializeContents();
		this._onDidChangeTreeData.fire(undefined);
	}

	public async initializeContents(): Promise<void> {
		this._bookItems = [];
		this._allNotebooks = new Map<string, BookTreeItem>();
		if (this.isNotebook) {
			this.readNotebook();
		} else {
			await this.readBookStructure();
			await this.loadTableOfContentFiles();
			await this.readBooks();
		}
	}

	public async readBookStructure(): Promise<void> {
		// check book structure to determine version
		let isOlderVersion: boolean;
		this._configPath = path.posix.join(this.bookPath, '_config.yml');
		try {
			isOlderVersion = (await fs.stat(path.posix.join(this.bookPath, '_data'))).isDirectory() && (await fs.stat(path.posix.join(this.bookPath, content))).isDirectory();
		} catch {
			isOlderVersion = false;
		}

		if (isOlderVersion) {
			let isTocFile = (await fs.stat(path.posix.join(this.bookPath, '_data', 'toc.yml'))).isFile();
			if (isTocFile) {
				this._tableOfContentsPath = path.posix.join(this.bookPath, '_data', 'toc.yml');
			}
			this._bookVersion = BookVersion.v1;
			this._contentFolderPath = path.posix.join(this.bookPath, content, '');
			this._rootPath = path.dirname(path.dirname(this._tableOfContentsPath));
		} else {
			this._contentFolderPath = this.bookPath;
			this._tableOfContentsPath = path.posix.join(this.bookPath, '_toc.yml');
			this._rootPath = path.dirname(this._tableOfContentsPath);
			this._bookVersion = BookVersion.v2;
		}
	}

	public getAllNotebooks(): Map<string, BookTreeItem> {
		return this._allNotebooks;
	}

	public getNotebook(uri: string): BookTreeItem | undefined {
		return this._allNotebooks.get(this.openAsUntitled ? path.basename(uri) : uri);
	}

	public async loadTableOfContentFiles(): Promise<void> {
		if (this.isNotebook) {
			return;
		}

		if (await fs.pathExists(this._tableOfContentsPath)) {
			vscode.commands.executeCommand('setContext', 'bookOpened', true);
			this.watchTOC();
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
			root: this.notebookRootPath ? this.notebookRootPath : pathDetails.dir,
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
			// convert to URI to avoid causing issue with drive letters when getting navigation links
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
			try {
				let fileContents = await fsPromises.readFile(this._configPath, 'utf-8');
				const config = yaml.safeLoad(fileContents.toString());
				fileContents = await fsPromises.readFile(this._tableOfContentsPath, 'utf-8');
				let tableOfContents: any = yaml.safeLoad(fileContents.toString());
				let book: BookTreeItem = new BookTreeItem({
					version: this._bookVersion,
					title: config.title,
					contentPath: this._tableOfContentsPath,
					root: this._rootPath,
					tableOfContents: { sections: this.parseJupyterSections(this._bookVersion, tableOfContents) },
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
				throw new Error(this._errorMessage);
			}
		}
		return this._bookItems;
	}

	public get bookItems(): BookTreeItem[] {
		return this._bookItems;
	}

	public async getSections(tableOfContents: IJupyterBookToc, sections: JupyterBookSection[], root: string, book: BookTreeItemFormat): Promise<BookTreeItem[]> {
		let notebooks: BookTreeItem[] = [];
		for (let i = 0; i < sections.length; i++) {
			if (sections[i].url) {
				let externalLink: BookTreeItem = new BookTreeItem({
					title: sections[i].title,
					contentPath: undefined,
					root: root,
					tableOfContents: tableOfContents,
					page: sections[i],
					type: BookTreeItemType.ExternalLink,
					treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
					isUntitled: this.openAsUntitled,
					version: book.version
				},
					{
						light: this._extensionContext.asAbsolutePath('resources/light/link.svg'),
						dark: this._extensionContext.asAbsolutePath('resources/dark/link_inverse.svg')
					}
				);

				notebooks.push(externalLink);
			} else if (sections[i].file) {
				const pathToNotebook: string = getContentPath(book.version, book.root, sections[i].file.concat('.ipynb'));
				const pathToMarkdown: string = getContentPath(book.version, book.root, sections[i].file.concat('.md'));

				// Note: Currently, if there is an ipynb and a md file with the same name, Jupyter Books only shows the notebook.
				// Following Jupyter Books behavior for now
				if (await fs.pathExists(pathToNotebook)) {
					let notebook = new BookTreeItem({
						title: sections[i].title ? sections[i].title : sections[i].file,
						contentPath: pathToNotebook,
						root: root,
						tableOfContents: tableOfContents,
						page: sections[i],
						type: BookTreeItemType.Notebook,
						treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
						isUntitled: this.openAsUntitled,
						version: book.version
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
						// convert to URI to avoid causing issue with drive letters when getting navigation links
						let uriToNotebook: vscode.Uri = vscode.Uri.file(pathToNotebook);
						if (!this._allNotebooks.get(uriToNotebook.fsPath)) {
							this._allNotebooks.set(uriToNotebook.fsPath, notebook);
						}
						notebooks.push(notebook);
					}
				} else if (await fs.pathExists(pathToMarkdown)) {
					let markdown: BookTreeItem = new BookTreeItem({
						title: sections[i].title ? sections[i].title : sections[i].file,
						contentPath: pathToMarkdown,
						root: root,
						tableOfContents: tableOfContents,
						page: sections[i],
						type: BookTreeItemType.Markdown,
						treeItemCollapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
						isUntitled: this.openAsUntitled,
						version: book.version
					},
						{
							light: this._extensionContext.asAbsolutePath('resources/light/markdown.svg'),
							dark: this._extensionContext.asAbsolutePath('resources/dark/markdown_inverse.svg')
						}
					);
					notebooks.push(markdown);
				} else {
					this._errorMessage = loc.missingFileError(sections[i].title, book.title);
					vscode.window.showErrorMessage(this._errorMessage);
				}
			}
		}
		return notebooks;
	}

	/**
	 * Recursively parses out a section of a Jupyter Book.
	 * @param section The input data to parse
	 */
	public parseJupyterSections(version: string, section: any[]): JupyterBookSection[] {
		try {
			return section.reduce((acc, val) => Array.isArray(val.sections) ?
				acc.concat(convertFrom(version, val)).concat(this.parseJupyterSections(version, val.sections)) : acc.concat(convertFrom(version, val)), []);
		} catch (e) {
			this._errorMessage = loc.invalidTocFileError();
			if (section.length > 0) {
				this._errorMessage = loc.invalidTocError(section[0].title);
			}
			throw new Error(this._errorMessage);
		}
	}

	public get tableOfContentsPath(): string {
		return this._tableOfContentsPath;
	}

	public get contentFolderPath(): string {
		return this._contentFolderPath;
	}

	public get configPath(): string {
		return this._configPath;
	}

	public get errorMessage(): string {
		return this._errorMessage;
	}

	public get version(): string {
		return this._bookVersion;
	}
}

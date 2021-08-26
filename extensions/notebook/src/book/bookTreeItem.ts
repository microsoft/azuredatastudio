/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import { JupyterBookSection, IJupyterBookToc } from '../contracts/content';
import * as loc from '../common/localizedConstants';
import { isBookItemPinned, getNotebookType } from '../common/utils';
import { BookVersion, getContentPath, getTocPath } from './bookVersionHandler';

export enum BookTreeItemType {
	Book = 'Book',
	Notebook = 'Notebook',
	Markdown = 'Markdown',
	ExternalLink = 'ExternalLink',
	providedBook = 'providedBook',
	savedBook = 'savedBook',
	unsavedNotebook = 'unsavedNotebook',
	savedNotebook = 'savedNotebook',
	pinnedNotebook = 'pinnedNotebook',
	section = 'section',
	savedBookNotebook = 'savedBookNotebook'
}

export interface BookTreeItemFormat {
	title: string;
	contentPath: string;
	root: string;
	tableOfContents: IJupyterBookToc;
	page: any;
	type: BookTreeItemType;
	treeItemCollapsibleState: number;
	isUntitled: boolean;
	version?: BookVersion;
	parent?: BookTreeItem;
	hasChildren?: boolean;
}

export class BookTreeItem extends vscode.TreeItem {
	public sections: JupyterBookSection[] | undefined;
	public uri: string | undefined;
	private _previousUri: string;
	private _nextUri: string;
	public override command: vscode.Command;
	public override resourceUri: vscode.Uri;
	public rootContentPath: string;
	public tableOfContentsPath: string;

	constructor(public book: BookTreeItemFormat, icons: any) {
		super(book.title, book.treeItemCollapsibleState);
		if (book.type === BookTreeItemType.Book) {
			this.collapsibleState = book.treeItemCollapsibleState;
			this.sections = book.page;
			if (book.isUntitled) {
				this.contextValue = BookTreeItemType.providedBook;
			} else {
				this.contextValue = BookTreeItemType.savedBook;
			}
		} else {
			if (book.page && book.page.sections && book.page.sections.length > 0) {
				this.contextValue = BookTreeItemType.section;
			} else if (book.type === BookTreeItemType.Notebook && !book.tableOfContents.sections) {
				if (book.isUntitled) {
					this.contextValue = BookTreeItemType.unsavedNotebook;
				} else {
					this.contextValue = isBookItemPinned(book.contentPath) ? BookTreeItemType.pinnedNotebook : getNotebookType(book);
				}
			} else if (book.type === BookTreeItemType.ExternalLink) {
				this.contextValue = BookTreeItemType.ExternalLink;

			} else {
				this.contextValue = book.type === BookTreeItemType.Notebook ? (isBookItemPinned(book.contentPath) ? BookTreeItemType.pinnedNotebook : getNotebookType(book)) : BookTreeItemType.Markdown;
			}
			this.setPageVariables();
			this.setCommand();
		}
		this.iconPath = icons;
		this.tableOfContentsPath = undefined;

		if (this.book.type === BookTreeItemType.ExternalLink) {
			this.tooltip = `${this.uri}`;
		}
		else {
			// if it's a section, book or a notebook's book then we set the table of contents path.
			if (this.book.type === BookTreeItemType.Book || this.contextValue === BookTreeItemType.section || this.contextValue === BookTreeItemType.savedBookNotebook || this.book.tableOfContents.sections && book.type === BookTreeItemType.Markdown) {
				this.tableOfContentsPath = getTocPath(this.book.version, this.book.root);
			}
			this.rootContentPath = getContentPath(this.book.version, this.book.root, '');
			this.tooltip = this.book.type === BookTreeItemType.Book ? this.rootContentPath : this.book.contentPath;
			this.resourceUri = this.book.type === BookTreeItemType.Book ? vscode.Uri.file(this.book.root) : vscode.Uri.file(this.book.contentPath);
		}
	}

	private setPageVariables(): void {
		this.collapsibleState = (this.book.page.sections || this.book.page.subsections) && this.book.page.expand_sections ?
			vscode.TreeItemCollapsibleState.Expanded :
			this.book.page.sections || this.book.page.subsections ?
				vscode.TreeItemCollapsibleState.Collapsed :
				vscode.TreeItemCollapsibleState.None;
		this.sections = this.book.page.sections || this.book.page.subsections;
		this.uri = this.book.page.file ? this.book.page.file?.replace(/\\/g, '/') : this.book.page.url?.replace(/\\/g, '/');

		if (this.book.tableOfContents.sections) {
			let index = (this.book.tableOfContents.sections.indexOf(this.book.page));
			this.setPreviousUri(index);
			this.setNextUri(index);
		}
	}

	private setCommand(): void {
		if (this.book.type === BookTreeItemType.Notebook) {
			// The Notebook editor expects a posix path for the resource (it will still resolve to the correct fsPath based on OS)
			this.command = { command: this.book.isUntitled ? 'bookTreeView.openUntitledNotebook' : 'bookTreeView.openNotebook', title: loc.openNotebookCommand, arguments: [this.book.contentPath], };
		} else if (this.book.type === BookTreeItemType.Markdown) {
			this.command = { command: 'bookTreeView.openMarkdown', title: loc.openMarkdownCommand, arguments: [this.book.contentPath], };
		} else if (this.book.type === BookTreeItemType.ExternalLink) {
			this.command = { command: 'bookTreeView.openExternalLink', title: loc.openExternalLinkCommand, arguments: [this.uri], };
		}
	}

	private setPreviousUri(index: number): void {
		let i = --index;
		while (i > -1) {
			let pathToNotebook: string;
			if (this.book.tableOfContents.sections[i].file) {
				// The Notebook editor expects a posix path for the resource (it will still resolve to the correct fsPath based on OS)
				pathToNotebook = getContentPath(this.book.version, this.book.root, this.book.tableOfContents.sections[i].file);
				pathToNotebook = pathToNotebook.concat('.ipynb');
			}
			// eslint-disable-next-line no-sync
			if (fs.existsSync(pathToNotebook)) {
				this._previousUri = pathToNotebook;
				return;
			}
			i--;
		}
	}

	private setNextUri(index: number): void {
		let i = ++index;
		while (i < this.book.tableOfContents.sections.length) {
			let pathToNotebook: string;
			if (this.book.tableOfContents.sections[i].file) {
				// The Notebook editor expects a posix path for the resource (it will still resolve to the correct fsPath based on OS)
				pathToNotebook = getContentPath(this.book.version, this.book.root, this.book.tableOfContents.sections[i].file);
				pathToNotebook = pathToNotebook.concat('.ipynb');
			}
			// eslint-disable-next-line no-sync
			if (fs.existsSync(pathToNotebook)) {
				this._nextUri = pathToNotebook;
				return;
			}
			i++;
		}
	}

	public get title(): string {
		return this.book.title;
	}

	public get root(): string {
		return this.book.root;
	}

	public get tableOfContents(): IJupyterBookToc {
		return this.book.tableOfContents;
	}

	public get previousUri(): string {
		return this._previousUri;
	}

	public get nextUri(): string {
		return this._nextUri;
	}

	public override readonly tooltip: string;


	public get hasChildren(): boolean | undefined {
		return this.book.hasChildren;
	}

	public set hasChildren(hasChildren: boolean | undefined) {
		this.book.hasChildren = hasChildren;
	}

	public get parent(): BookTreeItem {
		return this.book.parent;
	}

	public set parent(parent: BookTreeItem) {
		this.book.parent = parent;
	}

	/**
	 * Helper method to find a child section with a specified URL
	 * @param url The url of the section we're searching for
	 */
	public findChildSection(url?: string): JupyterBookSection | undefined {
		if (!url) {
			return undefined;
		}
		return this.findChildSectionRecur(this as JupyterBookSection, url);
	}

	private findChildSectionRecur(section: JupyterBookSection, url: string): JupyterBookSection | undefined {
		if (section.file && section.file === url) {
			return section;
		} else if (section.sections) {
			for (const childSection of section.sections) {
				const foundSection = this.findChildSectionRecur(childSection, url);
				if (foundSection) {
					return foundSection;
				}
			}
		}
		return undefined;
	}
}

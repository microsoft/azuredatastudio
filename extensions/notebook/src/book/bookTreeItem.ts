/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IJupyterBookSection, IJupyterBookToc } from '../contracts/content';
import * as loc from '../common/localizedConstants';

export enum BookTreeItemType {
	Book = 'Book',
	Notebook = 'Notebook',
	Markdown = 'Markdown',
	ExternalLink = 'ExternalLink'
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
}

export class BookTreeItem extends vscode.TreeItem {
	private _sections: IJupyterBookSection[];
	private _uri: string | undefined;
	private _previousUri: string;
	private _nextUri: string;
	public command: vscode.Command;

	constructor(public book: BookTreeItemFormat, icons: any) {
		super(book.title, book.treeItemCollapsibleState);

		if (book.type === BookTreeItemType.Book) {
			this.collapsibleState = book.treeItemCollapsibleState;
			this._sections = book.page;
			if (book.isUntitled) {
				this.contextValue = 'providedBook';
			} else {
				this.contextValue = 'savedBook';
			}
		} else {
			if (book.page && book.page.sections && book.page.sections.length > 0) {
				this.contextValue = 'section';
			} else if (book.type === BookTreeItemType.Notebook && !book.tableOfContents.sections) {
				if (book.isUntitled) {
					this.contextValue = 'unsavedNotebook';
				} else {
					this.contextValue = 'savedNotebook';
				}
			}
			this.setPageVariables();
			this.setCommand();
		}
		this.iconPath = icons;
	}

	private setPageVariables() {
		this.collapsibleState = (this.book.page.sections || this.book.page.subsections) && this.book.page.expand_sections ?
			vscode.TreeItemCollapsibleState.Expanded :
			this.book.page.sections || this.book.page.subsections ?
				vscode.TreeItemCollapsibleState.Collapsed :
				vscode.TreeItemCollapsibleState.None;
		this._sections = this.book.page.sections || this.book.page.subsections;
		this._uri = this.book.page.url;

		if (this.book.tableOfContents.sections) {
			let index = (this.book.tableOfContents.sections.indexOf(this.book.page));
			this.setPreviousUri(index);
			this.setNextUri(index);
		}
	}

	private setCommand() {
		if (this.book.type === BookTreeItemType.Notebook) {
			// The Notebook editor expects a posix path for the resource (it will still resolve to the correct fsPath based on OS)
			this.command = { command: this.book.isUntitled ? 'bookTreeView.openUntitledNotebook' : 'bookTreeView.openNotebook', title: loc.openNotebookCommand, arguments: [this.book.contentPath], };
		} else if (this.book.type === BookTreeItemType.Markdown) {
			this.command = { command: 'bookTreeView.openMarkdown', title: loc.openMarkdownCommand, arguments: [this.book.contentPath], };
		} else if (this.book.type === BookTreeItemType.ExternalLink) {
			this.command = { command: 'bookTreeView.openExternalLink', title: loc.openExternalLinkCommand, arguments: [this._uri], };
		}
	}

	private setPreviousUri(index: number): void {
		let i = --index;
		while (i > -1) {
			if (this.book.tableOfContents.sections[i].url) {
				// The Notebook editor expects a posix path for the resource (it will still resolve to the correct fsPath based on OS)
				let pathToNotebook = path.posix.join(this.book.root, 'content', this.book.tableOfContents.sections[i].url.concat('.ipynb'));
				// eslint-disable-next-line no-sync
				if (fs.existsSync(pathToNotebook)) {
					this._previousUri = pathToNotebook;
					return;
				}
			}
			i--;
		}
	}

	private setNextUri(index: number): void {
		let i = ++index;
		while (i < this.book.tableOfContents.sections.length) {
			if (this.book.tableOfContents.sections[i].url) {
				// The Notebook editor expects a posix path for the resource (it will still resolve to the correct fsPath based on OS)
				let pathToNotebook = path.posix.join(this.book.root, 'content', this.book.tableOfContents.sections[i].url.concat('.ipynb'));
				// eslint-disable-next-line no-sync
				if (fs.existsSync(pathToNotebook)) {
					this._nextUri = pathToNotebook;
					return;
				}
			}
			i++;
		}
	}

	public get title(): string {
		return this.book.title;
	}

	public get uri(): string | undefined {
		return this._uri;
	}

	public get root(): string {
		return this.book.root;
	}

	public get tableOfContents(): IJupyterBookToc {
		return this.book.tableOfContents;
	}

	public get sections(): any[] {
		return this._sections;
	}

	public get previousUri(): string {
		return this._previousUri;
	}

	public get nextUri(): string {
		return this._nextUri;
	}

	get tooltip(): string {
		if (this.book.type === BookTreeItemType.ExternalLink) {
			return `${this._uri}`;
		}
		else {
			return this.book.type === BookTreeItemType.Book ? this.book.root : this.book.contentPath;
		}
	}

	/**
	 * Helper method to find a child section with a specified URL
	 * @param url The url of the section we're searching for
	 */
	public findChildSection(url?: string): IJupyterBookSection | undefined {
		if (!url) {
			return undefined;
		}
		return this.findChildSectionRecur(this, url);
	}

	private findChildSectionRecur(section: IJupyterBookSection, url: string): IJupyterBookSection | undefined {
		if (section.url && section.url === url) {
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

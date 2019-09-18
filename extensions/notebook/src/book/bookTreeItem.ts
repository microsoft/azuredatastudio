/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as nls from 'vscode-nls';
import { IJupyterBookSection, IJupyterBookToc } from '../contracts/content';
const localize = nls.loadMessageBundle();

export enum BookTreeItemType {
	Book = 'Book',
	Notebook = 'Notebook',
	Markdown = 'Markdown',
	ExternalLink = 'ExternalLink'
}

export interface BookTreeItemFormat {
	title: string;
	root: string;
	tableOfContents: IJupyterBookToc;
	page: any;
	type: BookTreeItemType;
	treeItemCollapsibleState: number;
}

export class BookTreeItem extends vscode.TreeItem {
	private _sections: IJupyterBookSection[];
	private _uri: string;
	private _previousUri: string;
	private _nextUri: string;
	public command: vscode.Command;

	constructor(public book: BookTreeItemFormat, icons: any) {
		super(book.title, book.treeItemCollapsibleState);

		if (book.type === BookTreeItemType.Book) {
			this.collapsibleState = book.treeItemCollapsibleState;
			this._sections = book.page;
		} else {
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

		let index = (this.book.tableOfContents.sections.indexOf(this.book.page));
		this.setPreviousUri(index);
		this.setNextUri(index);
	}

	private setCommand() {
		if (this.book.type === BookTreeItemType.Notebook) {
			let pathToNotebook = path.join(this.book.root, 'content', this._uri.concat('.ipynb'));
			this.command = { command: 'bookTreeView.openNotebook', title: localize('openNotebookCommand', 'Open Notebook'), arguments: [pathToNotebook], };
		} else if (this.book.type === BookTreeItemType.Markdown) {
			let pathToMarkdown = path.join(this.book.root, 'content', this._uri.concat('.md'));
			this.command = { command: 'bookTreeView.openMarkdown', title: localize('openMarkdownCommand', 'Open Markdown'), arguments: [pathToMarkdown], };
		} else if (this.book.type === BookTreeItemType.ExternalLink) {
			this.command = { command: 'bookTreeView.openExternalLink', title: localize('openExternalLinkCommand', 'Open External Link'), arguments: [this._uri], };
		}
	}

	private setPreviousUri(index: number): void {
		let i = --index;
		while (i > -1) {
			if (this.book.tableOfContents.sections[i].url) {
				// TODO: Currently only navigating to notebooks. Need to add logic for markdown.
				let pathToNotebook = path.join(this.book.root, 'content', this.book.tableOfContents.sections[i].url.concat('.ipynb'));
				// tslint:disable-next-line:no-sync
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
				// TODO: Currently only navigating to notebooks. Need to add logic for markdown.
				let pathToNotebook = path.join(this.book.root, 'content', this.book.tableOfContents.sections[i].url.concat('.ipynb'));
				// tslint:disable-next-line:no-sync
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

	public get uri(): string {
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
			return undefined;
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

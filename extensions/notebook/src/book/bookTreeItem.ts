/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as nls from 'vscode-nls';
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
	tableOfContents: any[];
	page: any;
	type: BookTreeItemType;
}

export class BookTreeItem extends vscode.TreeItem {
	private _sections: any[];
	private _uri: string;
	private _previousUri: string;
	private _nextUri: string;
	public command: vscode.Command;

	constructor(public book: BookTreeItemFormat) {
		super(book.title, vscode.TreeItemCollapsibleState.Collapsed);

		if (book.type === BookTreeItemType.Book) {
			this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
			this._sections = book.page;
		} else {
			this.setPageVariables();
			this.setCommand();
		}
	}

	private setPageVariables() {
		this.collapsibleState = (this.book.page.sections || this.book.page.subsections) && this.book.page.expand_sections ?
			vscode.TreeItemCollapsibleState.Expanded :
			this.book.page.sections || this.book.page.subsections ?
				vscode.TreeItemCollapsibleState.Collapsed :
				vscode.TreeItemCollapsibleState.None;
		this._sections = this.book.page.sections || this.book.page.subsections;
		this._uri = this.book.page.url;

		let index = (this.book.tableOfContents.indexOf(this.book.page));
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
			if (this.book.tableOfContents[i].url) {
				// TODO: Currently only navigating to notebooks. Need to add logic for markdown.
				let pathToNotebook = path.join(this.book.root, 'content', this.book.tableOfContents[i].url.concat('.ipynb'));
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
		while (i < this.book.tableOfContents.length) {
			if (this.book.tableOfContents[i].url) {
				// TODO: Currently only navigating to notebooks. Need to add logic for markdown.
				let pathToNotebook = path.join(this.book.root, 'content', this.book.tableOfContents[i].url.concat('.ipynb'));
				if (fs.existsSync(pathToNotebook)) {
					this._nextUri = pathToNotebook;
					return;
				}
			}
			i++;
		}
	}

	public get root(): string {
		return this.book.root;
	}

	public get tableOfContents(): any[] {
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
}
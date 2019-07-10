/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class BookTreeItem extends vscode.TreeItem {
	public sections: any[];
	public uri: string;
	public previousUri: string;
	public nextUri: string;
	public command: vscode.Command;

	constructor(
		public title: string,
		public root: string,
		public tableOfContents: any[],
		public page: any,
		public pageType: string,
	) {
		super(title, vscode.TreeItemCollapsibleState.Collapsed);
		if (pageType === 'book') {
			this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
			this.sections = page;
		} else {
			this.setPageVariables();
			this.setCommand();
		}
	}

	contextValue = this.pageType;

	private setPageVariables() {
		this.collapsibleState = (this.page.sections || this.page.subsections) && this.page.expand_sections ?
			vscode.TreeItemCollapsibleState.Expanded :
			this.page.sections || this.page.subsections ?
				vscode.TreeItemCollapsibleState.Collapsed :
				vscode.TreeItemCollapsibleState.None;
		this.sections = this.page.sections || this.page.subsections;
		this.uri = this.page.url;

		let index = (this.tableOfContents.indexOf(this.page));
		this.setPreviousUri(index);
		this.setNextUri(index);
	}

	private setCommand() {
		if (this.pageType === 'notebook') {
			let pathToNotebook = path.join(this.root, 'content', this.uri.concat('.ipynb'));
			this.command = { command: 'bookTreeView.openNotebook', title: localize('openNotebookCommand', 'Open Notebook'), arguments: [pathToNotebook], };
		} else if (this.pageType === 'markdown') {
			let pathToMarkdown = path.join(this.root, 'content', this.uri.concat('.md'));
			this.command = { command: 'bookTreeView.openMarkdown', title: localize('openMarkdownCommand', 'Open Markdown'), arguments: [pathToMarkdown], };
		} else if (this.pageType === 'externalLink') {
			this.command = { command: 'bookTreeView.openExternalLink', title: localize('openExternalLinkCommand', 'Open External Link'), arguments: [this.uri], };
		}
	}

	private setPreviousUri(index: number): void {
		let i = --index;
		while (i > -1) {
			if (this.tableOfContents[i].url) {
				// TODO: Currently only navigating to notebooks. Need to add logic for markdown.
				let pathToNotebook = path.join(this.root, 'content', this.tableOfContents[i].url.concat('.ipynb'));
				if (fs.existsSync(pathToNotebook)) {
					this.previousUri = pathToNotebook;
					return;
				}
			}
			i--;
		}
		return null;
	}

	private setNextUri(index: number): void {
		let i = ++index;
		while (i < this.tableOfContents.length) {
			if (this.tableOfContents[i].url) {
				// TODO: Currently only navigating to notebooks. Need to add logic for markdown.
				let pathToNotebook = path.join(this.root, 'content', this.tableOfContents[i].url.concat('.ipynb'));
				if (fs.existsSync(pathToNotebook)) {
					this.nextUri = pathToNotebook;
					return;
				}
			}
			i++;
		}
		return null;
	}
}
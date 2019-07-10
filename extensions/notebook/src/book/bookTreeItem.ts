/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class BookTreeItem extends vscode.TreeItem {
	public sections: any[];
	public uri?: string;
	public previousUri?: string;
	public nextUri?: string;
	public command?: vscode.Command;

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
		this.previousUri = index > 0 && index <= this.tableOfContents.length ? path.join(this.root, 'content', this.tableOfContents[index - 1].url.concat('.ipynb')) : undefined;
		this.nextUri = index >= 0 && index < this.tableOfContents.length - 1 ? path.join(this.root, 'content', this.tableOfContents[index + 1].url.concat('.ipynb')) : undefined;
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
}
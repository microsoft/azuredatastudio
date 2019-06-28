/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { BookTreeItem } from './bookTreeItem';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();


export class BookTreeViewProvider implements vscode.TreeDataProvider<BookTreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<BookTreeItem | undefined> = new vscode.EventEmitter<BookTreeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<BookTreeItem | undefined> = this._onDidChangeTreeData.event;
	private _tableOfContentsPath: string[];

	constructor(private workspaceRoot: string) {
		if (workspaceRoot !== '') {
			this._tableOfContentsPath = this.getTocFiles(this.workspaceRoot);
			let bookOpened: boolean = this._tableOfContentsPath && this._tableOfContentsPath.length > 0;
			vscode.commands.executeCommand('setContext', 'bookOpened', bookOpened);
		}
	}

	private getTocFiles(dir: string): string[] {
		let allFiles: string[] = [];
		let files = fs.readdirSync(dir);
		for (let i in files) {
			let name = path.join(dir, files[i]);
			if (fs.statSync(name).isDirectory()) {
				allFiles = allFiles.concat(this.getTocFiles(name));
			} else if (files[i] === 'toc.yml') {
				allFiles.push(name);
			}
		}
		return allFiles;
	}

	async openNotebook(resource: string): Promise<void> {
		try {
			let doc = await vscode.workspace.openTextDocument(resource);
			vscode.window.showTextDocument(doc);
		} catch (e) {
			vscode.window.showErrorMessage(localize('openNotebookError', 'Open file {0} failed: {1}',
				resource,
				e instanceof Error ? e.message : e));
		}
	}

	openMarkdown(resource: string): void {
		try {
			vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(resource));
		} catch (e) {
			vscode.window.showErrorMessage(localize('openMarkdownError', 'Open file {0} failed: {1}',
				resource,
				e instanceof Error ? e.message : e));
		}
	}

	openExternalLink(resource: string): void {
		try {
			vscode.env.openExternal(vscode.Uri.parse(resource));
		} catch (e) {
			vscode.window.showErrorMessage(localize('openExternalLinkError', 'Open link {0} failed: {1}',
				resource,
				e instanceof Error ? e.message : e));
		}
	}


	getTreeItem(element: BookTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: BookTreeItem): Thenable<BookTreeItem[]> {
		if (element) {
			if (element.tableOfContents) {
				return Promise.resolve(this.getSections(element.tableOfContents, element.root));
			} else {
				return Promise.resolve([]);
			}
		} else {
			return Promise.resolve(this.getBooks());
		}
	}

	private getBooks(): BookTreeItem[] {
		let books: BookTreeItem[] = [];
		for (let i in this._tableOfContentsPath) {
			let root = path.dirname(path.dirname(this._tableOfContentsPath[i]));
			try {
				const config = yaml.safeLoad(fs.readFileSync(path.join(root, '_config.yml'), 'utf-8'));
				const tableOfContents = yaml.safeLoad(fs.readFileSync(this._tableOfContentsPath[i], 'utf-8'));
				let book = new BookTreeItem(config.title, root, tableOfContents, vscode.TreeItemCollapsibleState.Collapsed);
				books.push(book);
			} catch (e) {
				vscode.window.showErrorMessage(localize('openConfigFileError', 'Open file {0} failed: {1}',
					path.join(root, '_config.yml'),
					e instanceof Error ? e.message : e));
			}
		}
		return books;
	}

	private getSections(sec: any[], root: string): BookTreeItem[] {
		let notebooks: BookTreeItem[] = [];
		for (let i = 0; i < sec.length; i++) {
			if (sec[i].url) {
				if (sec[i].external) {
					let externalLink = new BookTreeItem(sec[i].title, root, sec[i].sections, sec[i].sections ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None, sec[i].url, { command: 'bookTreeView.openExternalLink', title: localize('openExternalLinkCommand', 'Open External Link'), arguments: [sec[i].url], });
					notebooks.push(externalLink);
				} else {
					let pathToNotebook = path.join(root, 'content', sec[i].url.concat('.ipynb'));
					let pathToMarkdown = path.join(root, 'content', sec[i].url.concat('.md'));
					// Note: Currently, if there is an ipynb and a md file with the same name, Jupyter Books only shows the notebook.
					// Following Jupyter Books behavior for now
					if (fs.existsSync(pathToNotebook)) {
						let notebook = new BookTreeItem(sec[i].title, root, sec[i].sections || sec[i].subsections,
							(sec[i].sections || sec[i].subsections) && sec[i].expand_sections ? vscode.TreeItemCollapsibleState.Expanded : sec[i].sections || sec[i].subsections ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
							sec[i].url, { command: 'bookTreeView.openNotebook', title: localize('openNotebookCommand', 'Open Notebook'), arguments: [pathToNotebook], });
						notebooks.push(notebook);
					} else if (fs.existsSync(pathToMarkdown)) {
						let markdown = new BookTreeItem(sec[i].title, root, sec[i].sections || sec[i].subsections,
							(sec[i].sections || sec[i].subsections) && sec[i].expand_sections ? vscode.TreeItemCollapsibleState.Expanded : sec[i].sections || sec[i].subsections ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
							sec[i].url, { command: 'bookTreeView.openMarkdown', title: localize('openMarkdownCommand', 'Open Markdown'), arguments: [pathToMarkdown], });
						notebooks.push(markdown);
					} else {
						vscode.window.showErrorMessage(localize('missingFileError', 'Missing file : {0}', sec[i].title));
					}
				}
			} else {
				// TODO: search functionality (#6160)
			}
		}
		return notebooks;
	}
}
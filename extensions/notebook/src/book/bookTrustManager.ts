/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { BookTreeItem } from './bookTreeItem';
import { BookModel } from './bookModel';

export interface IBookTrustManager {
	isNotebookTrustedByDefault(notebookUri: string): boolean;
	setBookAsTrusted(bookRootPath: string): boolean;
}

export interface IBookTrustManagerWorkspaceDetails {
	workspaceFolders: vscode.WorkspaceFolder[];
	getConfiguration(section?: string | undefined): vscode.WorkspaceConfiguration;
}

export class BookTrustManager implements IBookTrustManager {

	private static notebookConfiguration: string = 'notebook';
	private static notebookTrustedBooksConfiguration: string = 'trustedBooks';
	private trustedLocalBooks: string[] = [];

	constructor(private books: BookModel[], private workspaceDetails?: IBookTrustManagerWorkspaceDetails) {
		if (!workspaceDetails) {
			this.workspaceDetails = {
				get getConfiguration() {
					return vscode.workspace.getConfiguration;
				},
				get workspaceFolders() {
					return [].concat(vscode.workspace.workspaceFolders || []);
				}
			};
		}
	}

	isNotebookTrustedByDefault(notebookUri: string): boolean {
		let allBooks: BookTreeItem[] = this.getAllBooks();
		let trustableBookPaths = this.getTrustableBookPaths();
		let trustableBooks: BookTreeItem[] = allBooks
			.filter(bookItem => trustableBookPaths.some(trustableBookPath => trustableBookPath === path.normalize(bookItem.book.root)));
		let isNotebookTrusted = this.isNotebookPartOfBooks(notebookUri, trustableBooks);

		return isNotebookTrusted;
	}

	isNotebookPartOfBooks(notebookUri: string, books: BookTreeItem[]) {
		let isPartOfNotebook: boolean = false;
		let trustedBook: BookTreeItem = books.find(book => notebookUri.startsWith(path.resolve(book.root)));

		if (trustedBook) {
			let fullBookBaseUriWithContent = path.join(trustedBook.root, 'content');
			let requestingNotebookFormattedUri = notebookUri.substring(fullBookBaseUriWithContent.length).replace('.ipynb', '');
			let notebookInTOC = trustedBook.tableOfContents.sections.find(jupyterSection => {
				let normalizedJupyterSectionUrl = jupyterSection.url && path.normalize(jupyterSection.url);
				return normalizedJupyterSectionUrl === requestingNotebookFormattedUri;
			});
			isPartOfNotebook = !!notebookInTOC;
		}

		return isPartOfNotebook;
	}

	getTrustableBookPaths() {
		let trustablePaths: string[];
		let bookPathsInConfig: string[] = this.getTrustedBookPathsInConfig();

		if (this.hasWorkspaceFolders()) {
			trustablePaths = bookPathsInConfig
				.map(trustableBookPath => this.workspaceDetails.workspaceFolders
					.map(workspaceFolder => path.join(workspaceFolder.uri.fsPath, trustableBookPath))
					.reduce((accumulator, currentTrustableBookPaths) => accumulator.concat(currentTrustableBookPaths)));

		} else {
			trustablePaths = bookPathsInConfig;
		}

		return trustablePaths;
	}
	getAllBooks(): BookTreeItem[] {
		return this.books
			.map(book => book.bookItems) // select all the books
			.reduce((accumulator, currentBookItemList) => accumulator.concat(currentBookItemList)); // flatten them to a single list
	}

	setBookAsTrusted(bookRootPath: string): boolean {
		let rootPathToStore: string = path.normalize(bookRootPath);
		let matchingWorkspaceFolder: vscode.WorkspaceFolder = this.workspaceDetails.workspaceFolders
			.find(ws => rootPathToStore.startsWith(path.normalize(ws.uri.fsPath)));

		// if notebook is stored in a workspace folder, then store only the relative directory
		if (matchingWorkspaceFolder) {
			rootPathToStore.replace(path.normalize(matchingWorkspaceFolder.uri.fsPath), '');
		}

		let existingBooks: string[] = this.getTrustedBookPathsInConfig();

		// if no match found in the configuration, then add it
		if (!existingBooks.find(notebookPath => path.normalize(notebookPath) === rootPathToStore)) {
			existingBooks.push(rootPathToStore);

			// update the configuration
			this.setTrustedBookPathsInConfig(existingBooks);
			return true;
		}
		return false;
	}

	getTrustedBookPathsInConfig(): string[] {
		let trustedBookPaths: string[] = this.trustedLocalBooks;

		if (this.hasWorkspaceFolders()) {
			let config: vscode.WorkspaceConfiguration = this.workspaceDetails.getConfiguration(BookTrustManager.notebookConfiguration);
			let trustedBookDirectories: string[] = config.get(BookTrustManager.notebookTrustedBooksConfiguration);

			trustedBookPaths = trustedBookDirectories;
		}

		return trustedBookPaths;
	}

	setTrustedBookPathsInConfig(bookPaths: string[]) {
		if (this.hasWorkspaceFolders()) {
			let config: vscode.WorkspaceConfiguration = this.workspaceDetails.getConfiguration(BookTrustManager.notebookConfiguration);

			config.update(BookTrustManager.notebookTrustedBooksConfiguration, bookPaths);
		} else {
			this.trustedLocalBooks = bookPaths;
		}
	}

	hasWorkspaceFolders(): boolean {
		return this.workspaceDetails.workspaceFolders && this.workspaceDetails.workspaceFolders.length > 0;
	}
}

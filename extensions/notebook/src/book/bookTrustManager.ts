/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import * as constants from './../common/constants';
import { BookTreeItem } from './bookTreeItem';
import { BookModel } from './bookModel';

export interface IBookTrustManager {
	isNotebookTrustedByDefault(notebookUri: string): boolean;
	setBookAsTrusted(bookRootPath: string): boolean;
	setBookAsUntrusted(bookRootPath: string): boolean;
}

export interface IBookTrustManagerWorkspaceDetails {
	workspaceFolders: vscode.WorkspaceFolder[];
	getConfiguration(section?: string | undefined): vscode.WorkspaceConfiguration;
}

enum TrustBookOperation {
	Add,
	Remove
}

export class BookTrustManager implements IBookTrustManager {

	private static notebookConfiguration: string = constants.notebookConfigKey;
	private static notebookTrustedBooksConfiguration: string = constants.trustedBooksConfigKey;
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
			.filter(bookItem => trustableBookPaths.some(trustableBookPath => trustableBookPath === path.join(bookItem.book.root, path.sep)));
		let isNotebookTrusted = trustableBooks.filter(bookItem => !!bookItem).some(bookItem => bookItem.hasNotebook(notebookUri));
		return isNotebookTrusted;
	}

	getTrustableBookPaths() {
		let trustablePaths: string[];
		let bookPathsInConfig: string[] = this.getTrustedBookPathsInConfig();

		if (this.hasWorkspaceFolders()) {
			trustablePaths = bookPathsInConfig
				.map(trustableBookPath => this.workspaceDetails.workspaceFolders
					.map(workspaceFolder => path.join(workspaceFolder.uri.fsPath, trustableBookPath)))
				.reduce((accumulator, currentTrustableBookPaths) => accumulator.concat(currentTrustableBookPaths), []);

		} else {
			trustablePaths = bookPathsInConfig;
		}

		return trustablePaths;
	}

	getAllBooks(): BookTreeItem[] {
		return this.books
			.map(book => book.bookItems) // select all the books
			.reduce((accumulator, currentBookItemList) => accumulator.concat(currentBookItemList), []);
	}

	setBookAsUntrusted(bookRootPath: string): boolean {
		return this.updateTrustedBooks(bookRootPath, TrustBookOperation.Remove);
	}

	setBookAsTrusted(bookRootPath: string): boolean {
		return this.updateTrustedBooks(bookRootPath, TrustBookOperation.Add);
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

	updateTrustedBooks(bookPath: string, operation: TrustBookOperation) {
		let modifiedTrustedBooks = false;
		let bookPathToChange: string = path.join(bookPath, path.sep);

		if (this.hasWorkspaceFolders()) {
			let matchingWorkspaceFolder: vscode.WorkspaceFolder = this.workspaceDetails.workspaceFolders
				.find(ws => bookPathToChange.startsWith(path.normalize(ws.uri.fsPath)));

			// if notebook is stored in a workspace folder, then store only the relative directory
			if (matchingWorkspaceFolder) {
				bookPathToChange = bookPathToChange.replace(path.normalize(matchingWorkspaceFolder.uri.fsPath), '');
			}
		}

		let trustedBooks: string[] = this.getTrustedBookPathsInConfig();
		let existingBookIndex = trustedBooks.map(trustedBookPath => path.normalize(trustedBookPath)).indexOf(bookPathToChange);

		if (existingBookIndex !== -1 && operation === TrustBookOperation.Remove) {
			trustedBooks.splice(existingBookIndex, 1);
			modifiedTrustedBooks = true;
		} else if (existingBookIndex === -1 && operation === TrustBookOperation.Add) {
			trustedBooks.push(bookPathToChange);
			modifiedTrustedBooks = true;
		}

		this.setTrustedBookPathsInConfig(trustedBooks);

		return modifiedTrustedBooks;
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import * as constants from './../common/constants';
import { BookTreeItem } from './bookTreeItem';
import { BookModel } from './bookModel';
import { BookVersion } from './bookVersionHandler';

export interface IBookTrustManager {
	isNotebookTrustedByDefault(notebookUri: string): boolean;
	setBookAsTrusted(bookRootPath: string, isTrusted: boolean): Promise<boolean>;
}

enum TrustBookOperation {
	Add,
	Remove
}

export class BookTrustManager implements IBookTrustManager {
	constructor(private books: BookModel[]) { }

	isNotebookTrustedByDefault(notebookUri: string): boolean {
		let normalizedNotebookUri: string = path.normalize(notebookUri);
		let treeBookItems: BookTreeItem[] = this.getBookTreeItems();
		let trustableBookPaths = this.getTrustableBookPaths();
		let hasTrustedBookPath: boolean = treeBookItems
			.filter(bookItem => trustableBookPaths.some(trustableBookPath => trustableBookPath === path.join(bookItem.book.root, path.sep)))
			.some(bookItem => normalizedNotebookUri.startsWith(bookItem.book.version === BookVersion.v1 ? path.join(bookItem.book.root, 'content', path.sep) : path.join(bookItem.book.root, path.sep)));
		let isNotebookTrusted = hasTrustedBookPath && this.books.some(bookModel => bookModel.getNotebook(vscode.Uri.file(normalizedNotebookUri).fsPath));
		return isNotebookTrusted;
	}

	getTrustableBookPaths() {
		let trustablePaths: string[];
		let bookPathsInConfig: string[] = this.getTrustedBookPathsInConfig();

		if (this.hasWorkspaceFolders()) {
			let workspaceFolders = vscode.workspace.workspaceFolders;

			trustablePaths = bookPathsInConfig
				.map(trustableBookPath => workspaceFolders
					.map(workspaceFolder => path.join(workspaceFolder.uri.fsPath, trustableBookPath)))
				.reduce((accumulator, currentTrustableBookPaths) => accumulator.concat(currentTrustableBookPaths), []);

		} else {
			trustablePaths = bookPathsInConfig;
		}

		return trustablePaths;
	}

	getBookTreeItems(): BookTreeItem[] {
		return this.books
			.map(book => book.bookItems) // select all the books
			.reduce((accumulator, currentBookItemList) => accumulator.concat(currentBookItemList), []);
	}

	async setBookAsTrusted(bookRootPath: string, isTrusted: boolean): Promise<boolean> {
		if (isTrusted) {
			return this.updateTrustedBooks(bookRootPath, TrustBookOperation.Add);
		}
		return this.updateTrustedBooks(bookRootPath, TrustBookOperation.Remove);
	}

	getTrustedBookPathsInConfig(): string[] {
		let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		let trustedBookDirectories: string[] = config.get(constants.trustedBooksConfigKey);

		return trustedBookDirectories;
	}

	async setTrustedBookPathsInConfig(bookPaths: string[]): Promise<void> {
		let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		let storeInWorspace: boolean = this.hasWorkspaceFolders();

		return config.update(constants.trustedBooksConfigKey, bookPaths, storeInWorspace ? false : vscode.ConfigurationTarget.Global);
	}

	hasWorkspaceFolders(): boolean {
		let workspaceFolders = vscode.workspace.workspaceFolders;
		return workspaceFolders && workspaceFolders.length > 0;
	}

	async updateTrustedBooks(bookPath: string, operation: TrustBookOperation): Promise<boolean> {
		let modifiedTrustedBooks = false;
		let bookPathToChange: string = path.join(bookPath, path.sep);

		if (this.hasWorkspaceFolders()) {
			let workspaceFolders = vscode.workspace.workspaceFolders;
			let matchingWorkspaceFolder: vscode.WorkspaceFolder = workspaceFolders
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

		await this.setTrustedBookPathsInConfig(trustedBooks);

		return modifiedTrustedBooks;
	}
}

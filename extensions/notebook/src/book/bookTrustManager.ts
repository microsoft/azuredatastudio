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
	rootPath: string;
	getConfiguration(section?: string | undefined): vscode.WorkspaceConfiguration;
}

export class BookTrustManager implements IBookTrustManager {

	private static notebookConfiguration: string = 'notebook';
	private static notebookTrustedBooksConfiguration: string = 'trustedBooks';
	private trustedLocalBooks: Record<string, boolean> = {};

	constructor(private books: BookModel[], private workspaceDetails?: IBookTrustManagerWorkspaceDetails) {
		if (!workspaceDetails) {
			this.workspaceDetails = {
				get getConfiguration() {
					return vscode.workspace.getConfiguration;
				},
				get rootPath() {
					return vscode.workspace.rootPath;
				}
			};
		}
	}

	isNotebookTrustedByDefault(notebookUri: string): boolean {
		let normalizedBookDirectory = this.getBookDirectory(notebookUri);
		let trustedBookDirectory = this.getTrustedBookDirectory(notebookUri, normalizedBookDirectory);

		if (normalizedBookDirectory && trustedBookDirectory) {
			let trustedBook = this.getTrustedBook(normalizedBookDirectory, trustedBookDirectory);

			if (trustedBook) {
				let fullBookBaseUri = trustedBookDirectory !== normalizedBookDirectory
					? path.join(normalizedBookDirectory, trustedBookDirectory) : normalizedBookDirectory;
				let fullBookBaseUriWithContent = path.join(fullBookBaseUri, 'content');
				let requestingNotebookFormattedUri = notebookUri.substring(fullBookBaseUriWithContent.length).replace('.ipynb', '');
				let notebookInTOC = trustedBook.tableOfContents.sections.find(jupyterSection => {
					let normalizedJupyterSectionUrl = jupyterSection.url && path.normalize(jupyterSection.url);
					return normalizedJupyterSectionUrl === requestingNotebookFormattedUri;
				});
				return !!notebookInTOC;
			}
		}

		return false;
	}

	setBookAsTrusted(bookRootPath: string): boolean {
		// add this TOC to the configuration list
		let workspacePathLength: number = this.workspaceDetails.rootPath ? path.resolve(this.workspaceDetails.rootPath).length : 0;
		let relativeBookPathStartingIndex = !!workspacePathLength ? workspacePathLength + 1 : 0;
		let relativeBookPath: string = path.normalize(path.resolve(bookRootPath).substring(relativeBookPathStartingIndex));
		let existingBooks: string[] = this.getTrustedBooksInConfig();

		// if no match found in the configuration, then add it
		if (!existingBooks.find(notebookPath => path.normalize(notebookPath) === relativeBookPath)) {
			existingBooks.push(relativeBookPath);

			// update the configuration
			this.setTrustedBooksInConfig(existingBooks);
			return true;
		}
		return false;
	}

	getBookDirectory(notebookUri: string): string {
		let workspace: vscode.WorkspaceFolder = this.getNotebookWorkspaceFolder(notebookUri);
		let normalizedContainerPath: string = workspace ? path.normalize(workspace?.uri.fsPath) : undefined;

		if (!normalizedContainerPath) {
			normalizedContainerPath = this.books
				.map(book => book.bookPath)
				.find(book => notebookUri.startsWith(book));
		}
		return normalizedContainerPath;
	}

	getTrustedBookDirectory(notebookUri: string, containerRootDirectory: string): string {
		let trustedBookDirectories: string[] = this.getTrustedBooksInConfig();

		if (trustedBookDirectories.some(trustedBookPath => trustedBookPath === containerRootDirectory)) {
			return containerRootDirectory;
		}

		let notebookUriWithoutBase: string = notebookUri.substring(path.normalize(containerRootDirectory).length + 1);
		return trustedBookDirectories.find(dir => notebookUriWithoutBase.startsWith(dir));
	}

	getTrustedBook(workspaceUri: string, baseBookUri: string): BookTreeItem {
		let trustedBook = this.books
			.map(book => book.bookItems) // select all the books
			.reduce((accumulator, currentBookItemList) => accumulator.concat(currentBookItemList)) // flatten them to a single list
			.find(bookTreeItem => {
				let normalizedRootPath = path.normalize(bookTreeItem.root);
				let fqnBookRootPath = workspaceUri !== baseBookUri ? path.join(workspaceUri, baseBookUri) : baseBookUri;
				return normalizedRootPath.startsWith(fqnBookRootPath);
			});
		return trustedBook;
	}

	getNotebookWorkspaceFolder(notebookUri: string): vscode.WorkspaceFolder {
		let workspace = vscode.workspace;
		let workspaceFolder = workspace.workspaceFolders?.find(wsFolder => {
			let normalizedWsFolderUri = path.normalize(wsFolder.uri.fsPath);
			return notebookUri.startsWith(normalizedWsFolderUri);
		});
		return workspaceFolder;
	}

	getTrustedBooksInConfig(): string[] {
		if (this.workspaceDetails.rootPath) {
			let config: vscode.WorkspaceConfiguration = this.workspaceDetails.getConfiguration(BookTrustManager.notebookConfiguration);
			let trustedBookDirectories: string[] = config.get(BookTrustManager.notebookTrustedBooksConfiguration);
			return trustedBookDirectories;
		} else {
			return Object.keys(this.trustedLocalBooks);
		}
	}

	setTrustedBooksInConfig(books: string[]) {
		if (this.workspaceDetails.rootPath) {
			let config: vscode.WorkspaceConfiguration = this.workspaceDetails.getConfiguration(BookTrustManager.notebookConfiguration);

			config.update(BookTrustManager.notebookTrustedBooksConfiguration, books);
		} else {
			this.trustedLocalBooks = {};
			this.books.forEach(book => {
				this.trustedLocalBooks[book.bookPath] = true;
			});
		}
	}
}

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
	setBookAsTrusted(bookTreeItem: BookTreeItem): boolean;
}

export class BookTrustManager implements IBookTrustManager {

	private static notebookConfiguration: string = 'notebook';
	private static notebookTrustedBooksConfiguration: string = 'trustedBooks';

	constructor(private books: BookModel[]) { }

	isNotebookTrustedByDefault(notebookUri: string): boolean {
		let workspace = this.getNotebookWorkspaceFolder(notebookUri);
		let normalizedWorkspacePath = path.normalize(workspace.uri.fsPath);
		let trustedBookDirectory = this.getTrustedBookDirectory(notebookUri, workspace);

		if (workspace && trustedBookDirectory) {
			let trustedBook = this.getTrustedBook(normalizedWorkspacePath, trustedBookDirectory);

			if (trustedBook) {
				let fullBookBaseUri = path.join(normalizedWorkspacePath, trustedBookDirectory, 'content');
				let requestingNotebookFormattedUri = notebookUri.substring(fullBookBaseUri.length).replace('.ipynb', '');
				let notebookInTOC = trustedBook.tableOfContents.sections.find(jupyterSection => {
					let normalizedJupyterSectionUrl = jupyterSection.url && path.normalize(jupyterSection.url);
					return normalizedJupyterSectionUrl === requestingNotebookFormattedUri;
				});
				return !!notebookInTOC;
			}
		}

		return false;
	}

	setBookAsTrusted(bookTreeItem: BookTreeItem): boolean {
		// add this TOC to the configuration list
		let workspacePathLength: number = path.resolve(vscode.workspace.rootPath).length;
		let relativeBookPath: string = path.normalize(path.resolve(bookTreeItem.book.root).substring(workspacePathLength + 1));
		let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(BookTrustManager.notebookConfiguration);
		let existingNotebooks: string[] = config[BookTrustManager.notebookTrustedBooksConfiguration];

		// if no match found in the configuration, then add it
		if (!existingNotebooks.find(notebookPath => path.normalize(notebookPath) === relativeBookPath)) {
			existingNotebooks.push(relativeBookPath);

			// update the configuration
			config.update(BookTrustManager.notebookTrustedBooksConfiguration, existingNotebooks);
			return true;
		}
		return false;
	}

	getTrustedBookDirectory(notebookUri: string, workspace: vscode.WorkspaceFolder): string {
		let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(BookTrustManager.notebookConfiguration);
		let trustedBookDirectories: string[] = config.get(BookTrustManager.notebookTrustedBooksConfiguration);
		let notebookUriWithoutBase: string = notebookUri.substring(path.normalize(workspace.uri.fsPath).length + 1);
		return trustedBookDirectories.find(dir => notebookUriWithoutBase.startsWith(dir));
	}

	getTrustedBook(workspaceUri: string, baseBookUri: string): BookTreeItem {
		let trustedBook = this.books
			.map(book => book.bookItems) // select all the books
			.reduce((accumulator, currentBookItemList) => accumulator.concat(currentBookItemList)) // flatten them to a single list
			.find(bookTreeItem => {
				let normalizedRootPath = path.normalize(bookTreeItem.root);
				let fqnBookRootPath = path.join(workspaceUri, baseBookUri);
				return normalizedRootPath.startsWith(fqnBookRootPath);
			});
		return trustedBook;
	}

	getNotebookWorkspaceFolder(notebookUri: string): vscode.WorkspaceFolder {
		let workspace = vscode.workspace;
		let workspaceFolder = workspace.workspaceFolders.find(wsFolder => {
			let normalizedWsFolderUri = path.normalize(wsFolder.uri.fsPath);
			return notebookUri.startsWith(normalizedWsFolderUri);
		});
		return workspaceFolder;
	}
}

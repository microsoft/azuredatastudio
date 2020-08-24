/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import * as constants from './../common/constants';
import { BookTreeItem } from './bookTreeItem';
import { BookModel } from './bookModel';

export interface IBookPinManager {
	isNotebookPinned(notebookUri: string): boolean;
	pinNotebook(notebook: BookTreeItem): boolean;
	unpinNotebook(notebook: BookTreeItem): boolean;
	getPinnedNotebooks(): string[];
}

enum PinBookOperation {
	Pin,
	Unpin
}

export class BookPinManager implements IBookPinManager {

	constructor(private books: BookModel[]) {
		this.setPinnedSectionContext();
	}

	setPinnedSectionContext(): void {
		if (this.getPinnedNotebooks().length > 0) {
			vscode.commands.executeCommand(constants.BuiltInCommands.SetContext, constants.showPinnedBooksContextKey, true);
		} else {
			vscode.commands.executeCommand(constants.BuiltInCommands.SetContext, constants.showPinnedBooksContextKey, false);
		}
	}

	isNotebookPinned(notebookUri: string): boolean {
		let normalizedNotebookUri: string = path.normalize(notebookUri);
		let treeBookItems: BookTreeItem[] = this.getBookTreeItems();
		let pinnableBookPaths = this.getPinnableBookPaths();
		let hasPinnedBookPath: boolean = treeBookItems
			.filter(bookItem => pinnableBookPaths.some(trustableBookPath => trustableBookPath === path.join(bookItem.book.root, path.sep)))
			.some(bookItem => normalizedNotebookUri.startsWith(path.join(bookItem.root, 'content', path.sep)));
		let isNotebookPinned = hasPinnedBookPath && this.books.some(bookModel => bookModel.getNotebook(normalizedNotebookUri));
		return isNotebookPinned;
	}

	static isBookItemPinned(notebookPath: string): boolean {
		let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		if (config.get(constants.pinnedBooksConfigKey)) {
			let pinnedNotebooks: string[] = config.get(constants.pinnedBooksConfigKey);
			if (pinnedNotebooks.indexOf(notebookPath + path.sep) > -1) {
				return true;
			}
		}
		return false;
	}

	getPinnableBookPaths() {
		let pinnablePaths: string[];
		let bookPathsInConfig: string[] = this.getPinnedBookPathsInConfig();

		if (this.hasWorkspaceFolders()) {
			let workspaceFolders = vscode.workspace.workspaceFolders;

			pinnablePaths = bookPathsInConfig
				.map(pinnableBookPath => workspaceFolders
					.map(workspaceFolder => path.join(workspaceFolder.uri.fsPath, pinnableBookPath)))
				.reduce((accumulator, currentPinnableBookPaths) => accumulator.concat(currentPinnableBookPaths), []);

		} else {
			pinnablePaths = bookPathsInConfig;
		}

		return pinnablePaths;
	}

	getPinnedNotebooks(): string[] {
		let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		let pinnedNotebooks: string[] = config.get(constants.pinnedBooksConfigKey) ?? [];

		return pinnedNotebooks;
	}

	getBookTreeItems(): BookTreeItem[] {
		return this.books
			.map(book => book.bookItems) // select all the books
			.reduce((accumulator, currentBookItemList) => accumulator.concat(currentBookItemList), []);
	}

	pinNotebook(notebook: BookTreeItem): boolean {
		return this.updatePinnedBooks(notebook, PinBookOperation.Pin);
	}

	unpinNotebook(notebook: BookTreeItem): boolean {
		return this.updatePinnedBooks(notebook, PinBookOperation.Unpin);
	}

	getPinnedBookPathsInConfig(): string[] {
		let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		let pinnedBookDirectories: string[] = config.get(constants.pinnedBooksConfigKey);

		return pinnedBookDirectories;
	}

	setPinnedBookPathsInConfig(bookPaths: string[]) {
		let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		let storeInWorspace: boolean = this.hasWorkspaceFolders();

		config.update(constants.pinnedBooksConfigKey, bookPaths, storeInWorspace ? false : vscode.ConfigurationTarget.Global);
	}

	hasWorkspaceFolders(): boolean {
		let workspaceFolders = vscode.workspace.workspaceFolders;
		return workspaceFolders && workspaceFolders.length > 0;
	}

	updatePinnedBooks(notebook: BookTreeItem, operation: PinBookOperation) {
		let modifiedPinnedBooks = false;
		let bookPathToChange: string = notebook.book.contentPath;

		if (this.hasWorkspaceFolders()) {
			let workspaceFolders = vscode.workspace.workspaceFolders;
			let matchingWorkspaceFolder: vscode.WorkspaceFolder = workspaceFolders
				.find(ws => bookPathToChange.startsWith(path.normalize(ws.uri.fsPath)));

			// if notebook is stored in a workspace folder, then store only the relative directory
			if (matchingWorkspaceFolder) {
				bookPathToChange = bookPathToChange.replace(path.normalize(matchingWorkspaceFolder.uri.fsPath), '');
			}
		}

		let pinnedBooks: string[] = this.getPinnedBookPathsInConfig();
		let existingBookIndex = pinnedBooks.map(pinnedBookPath => path.normalize(pinnedBookPath)).indexOf(bookPathToChange);

		if (existingBookIndex !== -1 && operation === PinBookOperation.Unpin) {
			pinnedBooks.splice(existingBookIndex, 1);
			modifiedPinnedBooks = true;
		} else if (existingBookIndex === -1 && operation === PinBookOperation.Pin) {
			pinnedBooks.push(bookPathToChange);
			modifiedPinnedBooks = true;
		}

		this.setPinnedBookPathsInConfig(pinnedBooks);
		this.setPinnedSectionContext();

		return modifiedPinnedBooks;
	}
}

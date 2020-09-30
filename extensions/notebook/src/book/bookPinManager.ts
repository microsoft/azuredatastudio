/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import * as constants from './../common/constants';
import { BookTreeItem } from './bookTreeItem';
import { getPinnedNotebooks } from '../common/utils';

export interface IBookPinManager {
	pinNotebook(notebook: BookTreeItem): boolean;
	unpinNotebook(notebook: BookTreeItem): boolean;
}

enum PinBookOperation {
	Pin,
	Unpin
}

export class BookPinManager implements IBookPinManager {

	constructor() {
		this.setPinnedSectionContext();
	}

	setPinnedSectionContext(): void {
		if (getPinnedNotebooks().length > 0) {
			vscode.commands.executeCommand(constants.BuiltInCommands.SetContext, constants.showPinnedBooksContextKey, true);
		} else {
			vscode.commands.executeCommand(constants.BuiltInCommands.SetContext, constants.showPinnedBooksContextKey, false);
		}
	}

	isNotebookPinned(notebookPath: string): boolean {
		if (getPinnedNotebooks().findIndex(x => x === notebookPath) > -1) {
			return true;
		}
		return false;
	}

	pinNotebook(notebook: BookTreeItem): boolean {
		return this.isNotebookPinned(notebook.book.contentPath) ? false : this.updatePinnedBooks(notebook, PinBookOperation.Pin);
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import * as constants from './../common/constants';
import { BookTreeItem } from './bookTreeItem';
import { getPinnedNotebooks, setPinnedBookPathsInConfig, IPinnedNotebook } from '../common/utils';

export interface IBookPinManager {
	pinNotebook(notebook: BookTreeItem): Promise<boolean>;
	unpinNotebook(notebook: BookTreeItem): Promise<boolean>;
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
		if (getPinnedNotebooks().findIndex(x => x.notebookPath === notebookPath) > -1) {
			return true;
		}
		return false;
	}

	async pinNotebook(notebook: BookTreeItem): Promise<boolean> {
		return this.isNotebookPinned(notebook.book.contentPath) ? false : await this.updatePinnedBooks(notebook, PinBookOperation.Pin);
	}

	async unpinNotebook(notebook: BookTreeItem): Promise<boolean> {
		return await this.updatePinnedBooks(notebook, PinBookOperation.Unpin);
	}

	async updatePinnedBooks(notebook: BookTreeItem, operation: PinBookOperation): Promise<boolean> {
		let modifiedPinnedBooks = false;
		let bookPathToChange: string = notebook.book.contentPath;

		let pinnedBooks: IPinnedNotebook[] = getPinnedNotebooks();
		let existingBookIndex = pinnedBooks.map(pinnedBookPath => path.normalize(pinnedBookPath?.notebookPath)).indexOf(path.normalize(bookPathToChange));

		if (existingBookIndex !== -1 && operation === PinBookOperation.Unpin) {
			pinnedBooks.splice(existingBookIndex, 1);
			modifiedPinnedBooks = true;
		} else if (existingBookIndex === -1 && operation === PinBookOperation.Pin) {
			let addNotebook: IPinnedNotebook = { notebookPath: bookPathToChange, bookPath: notebook.book.root, title: notebook.book.title };
			pinnedBooks.push(addNotebook);
			modifiedPinnedBooks = true;
		}

		await setPinnedBookPathsInConfig(pinnedBooks);
		this.setPinnedSectionContext();
		return modifiedPinnedBooks;
	}
}

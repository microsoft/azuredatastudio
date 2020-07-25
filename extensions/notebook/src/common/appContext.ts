/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { NotebookUtils } from './notebookUtils';
import { BookTreeViewProvider } from '../book/bookTreeView';
import { NavigationProviders, BOOKS_VIEWID, PROVIDED_BOOKS_VIEWID, extensionOutputChannelName } from './constants';

/**
 * Global context for the application
 */
export class AppContext {

	public readonly notebookUtils: NotebookUtils;
	public readonly bookTreeViewProvider: BookTreeViewProvider;
	public readonly providedBookTreeViewProvider: BookTreeViewProvider;
	public readonly outputChannel: vscode.OutputChannel;

	constructor(public readonly extensionContext: vscode.ExtensionContext) {
		this.notebookUtils = new NotebookUtils();

		let workspaceFolders = vscode.workspace.workspaceFolders?.slice() ?? [];
		this.bookTreeViewProvider = new BookTreeViewProvider(workspaceFolders, extensionContext, false, BOOKS_VIEWID, NavigationProviders.NotebooksNavigator);
		this.providedBookTreeViewProvider = new BookTreeViewProvider([], extensionContext, true, PROVIDED_BOOKS_VIEWID, NavigationProviders.ProvidedBooksNavigator);
		this.outputChannel = vscode.window.createOutputChannel(extensionOutputChannelName);
	}
}

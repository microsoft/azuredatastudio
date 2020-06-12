/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as path from 'path';

import { JupyterController } from './jupyter/jupyterController';
import { AppContext } from './common/appContext';
import { ApiWrapper } from './common/apiWrapper';
import { IExtensionApi, IPackageManageProvider } from './types';
import { CellType } from './contracts/content';
import { NotebookUriHandler } from './protocol/notebookUriHandler';
import { BookTreeViewProvider } from './book/bookTreeView';
import { newNotebook, openNotebook, runActiveCell, runAllCells, clearActiveCellOutput, addCell, analyzeNotebook } from './common/notebookUtils';

const localize = nls.loadMessageBundle();

const BOOKS_VIEWID = 'bookTreeView';
const PROVIDED_BOOKS_VIEWID = 'providedBooksView';
let controller: JupyterController;
type ChooseCellType = { label: string, id: CellType };

export async function activate(extensionContext: vscode.ExtensionContext): Promise<IExtensionApi> {
	const createBookPath: string = path.posix.join(extensionContext.extensionPath, 'resources', 'notebooks', 'JupyterBooksCreate.ipynb');
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openBook', (bookPath: string, openAsUntitled: boolean, urlToOpen?: string) => openAsUntitled ? providedBookTreeViewProvider.openBook(bookPath, urlToOpen, true) : bookTreeViewProvider.openBook(bookPath, urlToOpen, true)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openNotebook', (resource) => bookTreeViewProvider.openNotebook(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openUntitledNotebook', (resource) => providedBookTreeViewProvider.openNotebookAsUntitled(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openMarkdown', (resource) => bookTreeViewProvider.openMarkdown(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openExternalLink', (resource) => bookTreeViewProvider.openExternalLink(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.saveBook', () => providedBookTreeViewProvider.saveJupyterBooks()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.trustBook', (resource) => bookTreeViewProvider.trustBook(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.searchBook', (item) => bookTreeViewProvider.searchJupyterBooks(item)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.searchUntitledBook', () => providedBookTreeViewProvider.searchJupyterBooks()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.openBook', () => bookTreeViewProvider.openNewBook()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.closeBook', (book: any) => bookTreeViewProvider.closeBook(book)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.closeNotebook', (book: any) => bookTreeViewProvider.closeBook(book)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.openNotebookFolder', () => bookTreeViewProvider.openNotebookFolder()));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.createBook', async () => {
		let untitledFileName: vscode.Uri = vscode.Uri.parse(`untitled:${createBookPath}`);
		await vscode.workspace.openTextDocument(createBookPath).then((document) => {
			azdata.nb.showNotebookDocument(untitledFileName, {
				connectionProfile: null,
				initialContent: document.getText(),
				initialDirtyState: false
			});
		});
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('_notebook.command.new', async (context?: azdata.ConnectedContext) => {
		let connectionProfile: azdata.IConnectionProfile = undefined;
		if (context && context.connectionProfile) {
			connectionProfile = context.connectionProfile;
		}
		return newNotebook(connectionProfile);
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.open', async () => {
		await openNotebook();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.runactivecell', async () => {
		await runActiveCell();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.runallcells', async () => {
		await runAllCells();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.clearactivecellresult', async () => {
		await clearActiveCellOutput();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addcell', async () => {
		let cellType: CellType;
		try {
			let cellTypes: ChooseCellType[] = [{
				label: localize('codeCellName', "Code"),
				id: 'code'
			},
			{
				label: localize('textCellName', "Text"),
				id: 'markdown'
			}];
			let selection = await vscode.window.showQuickPick(cellTypes, {
				placeHolder: localize('selectCellType', "What type of cell do you want to add?")
			});
			if (selection) {
				cellType = selection.id;
			}
		} catch (err) {
			return;
		}
		if (cellType) {
			await addCell(cellType);
		}
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addcode', async () => {
		await addCell('code');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addtext', async () => {
		await addCell('markdown');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.analyzeNotebook', async (explorerContext: azdata.ObjectExplorerContext) => {
		await analyzeNotebook(explorerContext);
	}));
	extensionContext.subscriptions.push(vscode.window.registerUriHandler(new NotebookUriHandler()));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('books.command.openLocalizedBooks', async () => {
		const urlToOpen: string = 'https://aka.ms/localized-BDC-book';
		await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(urlToOpen));
	}));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.revealInBooksViewlet', (uri: vscode.Uri, shouldReveal: boolean) => bookTreeViewProvider.revealActiveDocumentInViewlet(uri, shouldReveal)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.revealInUntitledBooksViewlet', (uri: vscode.Uri, shouldReveal: boolean) => providedBookTreeViewProvider.revealActiveDocumentInViewlet(uri, shouldReveal)));

	let appContext = new AppContext(extensionContext, new ApiWrapper());
	controller = new JupyterController(appContext);
	let result = await controller.activate();
	if (!result) {
		return undefined;
	}

	let workspaceFolders = vscode.workspace.workspaceFolders?.slice() ?? [];
	const bookTreeViewProvider = new BookTreeViewProvider(appContext.apiWrapper, workspaceFolders, extensionContext, false, BOOKS_VIEWID);
	await bookTreeViewProvider.initialized;
	const providedBookTreeViewProvider = new BookTreeViewProvider(appContext.apiWrapper, [], extensionContext, true, PROVIDED_BOOKS_VIEWID);
	await providedBookTreeViewProvider.initialized;

	azdata.nb.onDidChangeActiveNotebookEditor(e => {
		if (e.document.uri.scheme === 'untitled') {
			providedBookTreeViewProvider.revealActiveDocumentInViewlet(e.document.uri, false);
		} else {
			bookTreeViewProvider.revealActiveDocumentInViewlet(e.document.uri, false);
		}

	});

	return {
		getJupyterController() {
			return controller;
		},
		registerPackageManager(providerId: string, packageManagerProvider: IPackageManageProvider): void {
			controller.registerPackageManager(providerId, packageManagerProvider);
		},
		getPackageManagers() {
			return controller.packageManageProviders;
		}
	};
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (controller) {
		controller.deactivate();
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';

import { JupyterController } from './jupyter/jupyterController';
import { AppContext } from './common/appContext';
import { IExtensionApi, IPackageManageProvider } from './types';
import { CellType } from './contracts/content';
import { NotebookUriHandler } from './protocol/notebookUriHandler';
import { BuiltInCommands, unsavedBooksContextKey } from './common/constants';
import { RemoteBookController } from './book/remoteBookController';
import { RemoteBookDialog } from './dialog/remoteBookDialog';
import { RemoteBookDialogModel } from './dialog/remoteBookDialogModel';
import { IconPathHelper } from './common/iconHelper';
import { ExtensionContextHelper } from './common/extensionContextHelper';
import { BookTreeItem } from './book/bookTreeItem';

const localize = nls.loadMessageBundle();

let controller: JupyterController;
type ChooseCellType = { label: string, id: CellType };

export async function activate(extensionContext: vscode.ExtensionContext): Promise<IExtensionApi> {
	ExtensionContextHelper.setExtensionContext(extensionContext);
	IconPathHelper.setExtensionContext(extensionContext);

	const appContext = new AppContext(extensionContext);

	// TODO: Notebook doesn't work without root setting enabled in web mode. Once we start using non-root containers, we can remove this code.
	const config = vscode.workspace.getConfiguration('notebook');
	if (vscode.env.uiKind === vscode.UIKind.Web) {
		await config.update('allowRoot', true, vscode.ConfigurationTarget.Global);
	}
	/**
	 *  									***** IMPORTANT *****
	 * If changes are made to bookTreeView.openBook, please ensure backwards compatibility with its current state.
	 * This is the command used in the extension generator to open a Jupyter Book.
	 */
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openBook', (bookPath: string, openAsUntitled: boolean, urlToOpen?: string) => openAsUntitled ? providedBookTreeViewProvider.openBook(bookPath, urlToOpen, true) : bookTreeViewProvider.openBook(bookPath, urlToOpen, true)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.addFileToView', (resource: string) => bookTreeViewProvider.openBook(resource, resource, true, true)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openNotebook', (resource: string) => bookTreeViewProvider.openNotebook(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openUntitledNotebook', (resource: string) => providedBookTreeViewProvider.openNotebookAsUntitled(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openMarkdown', (resource: string) => bookTreeViewProvider.openMarkdown(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openExternalLink', (resource: string) => bookTreeViewProvider.openExternalLink(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.saveBook', () => providedBookTreeViewProvider.saveJupyterBooks()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.trustBook', (item: BookTreeItem) => bookTreeViewProvider.trustBook(item)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.searchBook', (item: BookTreeItem) => bookTreeViewProvider.searchJupyterBooks(item)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.searchProvidedBook', () => providedBookTreeViewProvider.searchJupyterBooks()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.openBook', () => bookTreeViewProvider.openNewBook()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.closeBook', (book: BookTreeItem) => bookTreeViewProvider.closeBook(book)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.closeNotebook', (notebook: BookTreeItem) => bookTreeViewProvider.closeBook(notebook)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.removeNotebook', (book: BookTreeItem) => bookTreeViewProvider.removeNotebook(book)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addNotebook', (book: BookTreeItem) => bookTreeViewProvider.createNotebook(book)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addMarkdown', (book: BookTreeItem) => bookTreeViewProvider.createMarkdownFile(book)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addSection', (book: BookTreeItem) => bookTreeViewProvider.createSection(book)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.createBook', () => bookTreeViewProvider.createBook()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.openNotebookFolder', (folderPath?: string, urlToOpen?: string, showPreview?: boolean) => bookTreeViewProvider.openNotebookFolder(folderPath, urlToOpen, showPreview)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.pinNotebook', async (book: BookTreeItem) => {
		await bookTreeViewProvider.pinNotebook(book);
		await pinnedBookTreeViewProvider.addNotebookToPinnedView(book);
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.unpinNotebook', async (book: BookTreeItem) => {
		await bookTreeViewProvider.unpinNotebook(book);
		await pinnedBookTreeViewProvider.removeNotebookFromPinnedView(book);
	}));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.moveTo', async (firstTreeItem: BookTreeItem, treeItems?: BookTreeItem[]) => {
		let allTreeItems = treeItems ? [firstTreeItem, ...treeItems] : [firstTreeItem];
		await bookTreeViewProvider.moveTreeItems(allTreeItems);
	}));

	let model = new RemoteBookDialogModel();
	let remoteBookController = new RemoteBookController(model, appContext.outputChannel);

	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.openRemoteBook', async () => {
		let dialog = new RemoteBookDialog(remoteBookController);
		return dialog.createDialog();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.undoNotebookView', async () => {
		await bookTreeViewProvider.undo();
	}));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('_notebook.command.new', async (options?: azdata.nb.NotebookShowOptions) => {
		return appContext.notebookUtils.newNotebook(options);
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.open', async () => {
		await appContext.notebookUtils.openNotebook();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.runactivecell', async () => {
		await appContext.notebookUtils.runActiveCell();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.runallcells', async () => {
		await appContext.notebookUtils.runAllCells();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.clearactivecellresult', async () => {
		await appContext.notebookUtils.clearActiveCellOutput();
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
			console.error('Unexpected error adding new cell: ', err);
			return;
		}
		if (cellType) {
			await appContext.notebookUtils.addCell(cellType);
		}
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addcode', async () => {
		await appContext.notebookUtils.addCell('code');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addtext', async () => {
		await appContext.notebookUtils.addCell('markdown');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.analyzeNotebook', async (explorerContext: azdata.ObjectExplorerContext) => {
		await appContext.notebookUtils.analyzeNotebook(explorerContext);
	}));
	extensionContext.subscriptions.push(vscode.window.registerUriHandler(new NotebookUriHandler()));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('books.command.openLocalizedBooks', async () => {
		const urlToOpen: string = 'https://aka.ms/localized-BDC-book';
		await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(urlToOpen));
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.boldText', async () => {
		await appContext.notebookUtils.toggleMarkdownStyle('bold');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.italicizeText', async () => {
		await appContext.notebookUtils.toggleMarkdownStyle('italic');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.underlineText', async () => {
		await appContext.notebookUtils.toggleMarkdownStyle('underline');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.codeBlock', async () => {
		await appContext.notebookUtils.toggleMarkdownStyle('formatBlock', false, 'pre');
	}));

	controller = new JupyterController(appContext);
	let result = await controller.activate();
	if (!result) {
		return undefined;
	}


	const bookTreeViewProvider = appContext.bookTreeViewProvider;
	await bookTreeViewProvider.initialized;
	const providedBookTreeViewProvider = appContext.providedBookTreeViewProvider;
	await providedBookTreeViewProvider.initialized;
	const pinnedBookTreeViewProvider = appContext.pinnedBookTreeViewProvider;
	await pinnedBookTreeViewProvider.initialized;

	azdata.nb.onDidChangeActiveNotebookEditor(e => {
		if (e.document.uri.scheme === 'untitled') {
			void providedBookTreeViewProvider.revealDocumentInTreeView(e.document.uri, false, false);
		} else {
			void bookTreeViewProvider.revealDocumentInTreeView(e.document.uri, false, false);
		}
	});

	azdata.nb.onDidOpenNotebookDocument(async e => {
		if (e.uri.scheme === 'untitled') {
			await vscode.commands.executeCommand(BuiltInCommands.SetContext, unsavedBooksContextKey, true);
		} else {
			await vscode.commands.executeCommand(BuiltInCommands.SetContext, unsavedBooksContextKey, false);
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
		},
		getAppContext() {
			return appContext;
		}
	};
}

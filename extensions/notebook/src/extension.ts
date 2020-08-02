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
import { IExtensionApi, IPackageManageProvider } from './types';
import { CellType } from './contracts/content';
import { NotebookUriHandler } from './protocol/notebookUriHandler';
import { BuiltInCommands, unsavedBooksContextKey } from './common/constants';
import { RemoteBookController } from './book/remoteBookController';
import { RemoteBookDialog } from './dialog/remoteBookDialog';
import { RemoteBookDialogModel } from './dialog/remoteBookDialogModel';

const localize = nls.loadMessageBundle();

let controller: JupyterController;
type ChooseCellType = { label: string, id: CellType };

export async function activate(extensionContext: vscode.ExtensionContext): Promise<IExtensionApi> {
	const appContext = new AppContext(extensionContext);
	const createBookPath: string = path.posix.join(extensionContext.extensionPath, 'resources', 'notebooks', 'JupyterBooksCreate.ipynb');
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openBook', (bookPath: string, openAsUntitled: boolean, urlToOpen?: string) => openAsUntitled ? providedBookTreeViewProvider.openBook(bookPath, urlToOpen, true) : bookTreeViewProvider.openBook(bookPath, urlToOpen, true)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openNotebook', (resource) => bookTreeViewProvider.openNotebook(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openUntitledNotebook', (resource) => providedBookTreeViewProvider.openNotebookAsUntitled(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openMarkdown', (resource) => bookTreeViewProvider.openMarkdown(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openExternalLink', (resource) => bookTreeViewProvider.openExternalLink(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.saveBook', () => providedBookTreeViewProvider.saveJupyterBooks()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.trustBook', (resource) => bookTreeViewProvider.trustBook(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.searchBook', (item) => bookTreeViewProvider.searchJupyterBooks(item)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.searchProvidedBook', () => providedBookTreeViewProvider.searchJupyterBooks()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.openBook', () => bookTreeViewProvider.openNewBook()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.closeBook', (book: any) => bookTreeViewProvider.closeBook(book)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.closeNotebook', (book: any) => bookTreeViewProvider.closeBook(book)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.openNotebookFolder', (folderPath?: string, urlToOpen?: string, showPreview?: boolean,) => bookTreeViewProvider.openNotebookFolder(folderPath, urlToOpen, showPreview)));
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

	let model = new RemoteBookDialogModel();
	let remoteBookController = new RemoteBookController(model, appContext.outputChannel);

	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.openRemoteBook', async () => {
		let dialog = new RemoteBookDialog(remoteBookController);
		dialog.createDialog();
	}));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('_notebook.command.new', async (context?: azdata.ConnectedContext) => {
		let connectionProfile: azdata.IConnectionProfile = undefined;
		if (context && context.connectionProfile) {
			connectionProfile = context.connectionProfile;
		}
		return appContext.notebookUtils.newNotebook(connectionProfile);
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

	controller = new JupyterController(appContext);
	let result = await controller.activate();
	if (!result) {
		return undefined;
	}


	const bookTreeViewProvider = appContext.bookTreeViewProvider;
	await bookTreeViewProvider.initialized;
	const providedBookTreeViewProvider = appContext.providedBookTreeViewProvider;
	await providedBookTreeViewProvider.initialized;

	azdata.nb.onDidChangeActiveNotebookEditor(e => {
		if (e.document.uri.scheme === 'untitled') {
			providedBookTreeViewProvider.revealActiveDocumentInViewlet(e.document.uri, false);
		} else {
			bookTreeViewProvider.revealActiveDocumentInViewlet(e.document.uri, false);
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

// this method is called when your extension is deactivated
export function deactivate() {
	if (controller) {
		controller.deactivate();
	}
}

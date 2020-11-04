/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
//import * as nls from 'vscode-nls';

import { JupyterController } from './jupyter/jupyterController';
import { AppContext } from './common/appContext';
import { IExtensionApi, IPackageManageProvider } from './types';

import { BuiltInCommands, unsavedBooksContextKey } from './common/constants';

import { IconPathHelper } from './common/iconHelper';
import { ExtensionContextHelper } from './common/extensionContextHelper';

//const localize = nls.loadMessageBundle();

let controller: JupyterController;

export async function activate(extensionContext: vscode.ExtensionContext): Promise<IExtensionApi> {
	ExtensionContextHelper.setExtensionContext(extensionContext);
	IconPathHelper.setExtensionContext(extensionContext);

	const appContext = new AppContext(extensionContext);
	/**
	 *  									***** IMPORTANT *****
	 * If changes are made to bookTreeView.openBook, please ensure backwards compatibility with its current state.
	 * This is the command used in the extension generator to open a Jupyter Book.
	 */

	extensionContext.subscriptions.push(vscode.commands.registerCommand('hybridtoolkit.command.openNotebookFolder', () => bookTreeViewProvider.openNotebookFolder()));


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

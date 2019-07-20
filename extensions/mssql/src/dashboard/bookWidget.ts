/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
	BookContributionProvider
} from './bookExtensions';

const localize = nls.loadMessageBundle();

export function registerBooksWidget(bookContributionProvider: BookContributionProvider): void {
	azdata.ui.registerModelViewProvider('books-widget', async (view) => {
		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '100%',
			height: '100%',
			alignItems: 'left'
		}).component();
		const bookslocationContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '270px',
			height: '100%',
			alignItems: 'left',
			position: 'absolute'
		}).component();
		const bookRow = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row'
		}).component();
		const tsgbooklink = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: localize('troubleshootingBooks', 'Troubleshooting Book'),
			title: localize('troubleshootingBooksTitle', 'Troubleshooting Book'),
		}).component();
		tsgbooklink.onDidClick(() => {
			PromptForFolder(bookContributionProvider);
		});

		bookRow.addItem(tsgbooklink, {
			CSSStyles: {
				'width': '100%',
				'color': '#0078d4',
				'text-decoration': 'underline',
				'padding-top': '10px',
				'text-align': 'left'
			}
		});
		container.addItem(bookRow, {
			CSSStyles: {
				'padding-left': '10px',
				'border-top': 'solid 1px #ccc',
				'box-sizing': 'border-box',
				'user-select': 'text'
			}
		});
		bookslocationContainer.addItem(container, {
			CSSStyles: {
				'padding-top': '25px',
				'padding-left': '5px'
			}
		});
		await view.initializeModel(bookslocationContainer);
	});
}

async function PromptForFolder(bookContributionProvider: BookContributionProvider) {
	let filter = {
		'All files': ['*']
	};
	let uris = await vscode.window.showOpenDialog({
		filters: filter,
		canSelectFiles: false,
		canSelectMany: false,
		canSelectFolders: true,
		openLabel: 'Pick Folder'
	});
	if (uris && uris.length > 0) {
		let pickedFolder = uris[0];
		saveBooksToFolder(pickedFolder, bookContributionProvider);
		promptToReloadWindow(pickedFolder);
	}
}

async function saveBooksToFolder(folderUri: vscode.Uri, bookContributionProvider: BookContributionProvider): Promise<void> {
	// Get book contributions
	if (bookContributionProvider.contributions.length > 0 && folderUri) {
		//remove folder if exists
		fs.removeSync(path.join(folderUri.path, 'SQL Big Data Books'));
		//copy them from the books extension:
		fs.copy(path.join(bookContributionProvider.contributions[0].path, 'content'), path.join(folderUri.path, 'SQL Big Data Books'));
	}
}
async function promptToReloadWindow(folderUri: vscode.Uri): Promise<void> {
	const actionReload = 'Reload';
	const actionOpenNew = 'Open New Instance';
	vscode.window.showInformationMessage(`Reload window in order for opening the jupyter books.`, actionReload, actionOpenNew)
		.then(selectedAction => {
			if (selectedAction === actionReload) {
				vscode.commands.executeCommand('workbench.action.setWorkspaceAndOpen', {
					forceNewWindow: false,
					folderPath: folderUri
				});
			}
			if (selectedAction === actionOpenNew) {
				vscode.commands.executeCommand('workbench.action.setWorkspaceAndOpen', {
					forceNewWindow: true,
					folderPath: folderUri
				});
			}
		});
}
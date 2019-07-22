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
	BookContributionProvider, BookContribution
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

		let books = bookContributionProvider.contributions.map(contribution => {
			const bookRow = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'row'
			}).component();
			const tsgbooklink = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				label: contribution.name,
				title: contribution.name
			}).component();
			tsgbooklink.onDidClick(() => {
				PromptForFolder(contribution);
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
			return bookRow;
		});


		container.addItems(books, {
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

async function PromptForFolder(bookContribution: BookContribution) {
	const allFilesFilter = localize('allFiles', "All Files");
	let filter = {};
	filter[allFilesFilter] = '*';
	let uris = await vscode.window.showOpenDialog({
		filters: filter,
		canSelectFiles: false,
		canSelectMany: false,
		canSelectFolders: true,
		openLabel: localize('labePickFolder', "Pick Folder")
	});
	if (uris && uris.length > 0) {
		let pickedFolder = uris[0];
		await saveBooksToFolder(pickedFolder, bookContribution);
		await promptToReloadWindow(pickedFolder);
	}
}

async function saveBooksToFolder(folderUri: vscode.Uri, bookContribution: BookContribution): Promise<void> {
	// Get book contributions
	if (bookContribution && folderUri) {
		//remove folder if exists
		await fs.removeSync(path.join(folderUri.path, bookContribution.name));
		//copy them from the books extension:
		await fs.copy(bookContribution.path, folderUri.path);
	}
}
function promptToReloadWindow(folderUri: vscode.Uri): void {
	const actionReload = localize('strReload', "Reload");
	const actionOpenNew = localize('strOpenNewInstance', "Open new instance");
	vscode.window.showInformationMessage(localize('informationOfOptions', "Reload window to open the Jupyter Books."), actionReload, actionOpenNew)
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
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import {
	BookContributionProvider
} from './bookExtensions';


export function registerBooksWidget(bookContributionProvider: BookContributionProvider): void {
	azdata.ui.registerModelViewProvider('books-widget', async (view) => {
		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '100%',
			height: '100%'
		}).component();
		const bookslocationContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '270px',
			height: '100%',
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
				let uri: vscode.Uri = vscode.Uri.file(contribution.path);
				openBookViewlet(uri);
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

function openBookViewlet(folderUri: vscode.Uri): void {
	vscode.commands.executeCommand('bookTreeView.openBook', folderUri.fsPath, true, undefined);
}

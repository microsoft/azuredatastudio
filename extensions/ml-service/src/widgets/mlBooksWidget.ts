/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
const fs = require('fs');
import { Dataspace } from '../models/dataspace';
import { fstat } from 'fs';

function addRow(container: azdata.FlexContainer, view: azdata.ModelView, component: azdata.Component) {
	const bookRow = view.modelBuilder.flexContainer().withLayout({
		flexFlow: 'row'
	}).component();
	bookRow.addItem(component, {
		CSSStyles: {
			'width': '100%',
			'color': '#0078d4',
			'text-decoration': 'underline',
			'padding-top': '10px',
			'text-align': 'left'
		}
	});
	container.addItems([bookRow]);
}

export function registerMlBooksWidget(dataspace: Dataspace): void {
	azdata.ui.registerModelViewProvider('ml-books', async (view) => {

		const container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '100%',
			height: '100%'
		})
			.component();
		let notebookFolder = path.join(__dirname, '..', '..', 'notebooks');
		// tslint:disable-next-line:no-sync
		let files = fs.readdirSync(notebookFolder);
		for (let index = 0; index < files.length; index++) {

			const file = files[index];
			if (!file.endsWith('.ipynb')) {
				continue;
			}

			const enableMlFlowButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				label: file,
				title: file
			}).component();

			enableMlFlowButton.onDidClick(async () => {
				let notebookPath = path.join(notebookFolder, file);
				let doc = await vscode.workspace.openTextDocument(notebookPath);
				vscode.window.showTextDocument(doc);
			});

			addRow(container, view, enableMlFlowButton);
		}
		const bookslocationContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '270px',
			height: '100%',
			position: 'absolute'
		}).component();

		bookslocationContainer.addItem(container, {
			CSSStyles: {
				'padding-top': '25px',
				'padding-left': '5px'
			}
		});
		await view.initializeModel(bookslocationContainer);
	});
}



/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { Dataspace } from '../models/dataspace';
import * as path from 'path';

export function registerMlEndpointsWidget(context: vscode.ExtensionContext, dataspace: Dataspace): void {
	azdata.ui.registerModelViewProvider('ml-endpoints', async (view) => {
		let settings = dataspace.Settings;
		let endpoint: {
			label: string,
			title: string,
			url: string
		};
		let isFile = false;
		if (settings && 'mlflow' in settings) {
			let mlflow = settings['mlflow'];
			endpoint = {
				label: mlflow,
				title: mlflow,
				url: mlflow
			};
		} else {
			isFile = true;
			let notebooksFolder = path.join(__dirname, '..', '..', 'notebooks');
			let notebookPath = path.join(notebooksFolder, 'Deploy MLFlow', 'Deploy MLFlow.ipynb');
			endpoint = {
				label: 'Deploy MLFlow to get a container endpoint',
				title: 'Deploy MLFlow to get a container endpoint',
				url: notebookPath
			};
		}

		const container = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%' }).component();
		const endPointRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'ML Flow' }).component();
		endPointRow.addItem(nameCell, { CSSStyles: { 'width': '35%', 'font-weight': '600', 'user-select': 'text' } });
		if (isFile) {
			let button = view.modelBuilder.text()
				.withProperties<azdata.TextComponentProperties>({
					value: endpoint.label
				}).component();
			button.onDidClick(async () => {
				let doc = await vscode.workspace.openTextDocument(endpoint.url);
				vscode.window.showTextDocument(doc);
			});
			endPointRow.addItem(button, { CSSStyles: { 'width': '62%', 'color': '#0078d4', 'text-decoration': 'underline', 'padding-top': '5px', 'overflow': 'hidden', 'text-overflow': 'ellipsis' } });

		} else {
			let linkCell = view.modelBuilder.hyperlink()
				.withProperties<azdata.HyperlinkComponentProperties>(endpoint).component();
			const copyValueCell = view.modelBuilder.button().component();
			copyValueCell.iconPath = { light: context.asAbsolutePath('resources/light/copy.png'), dark: context.asAbsolutePath('resources/dark/copy_inverse.png') };
			copyValueCell.onDidClick(() => {
				vscode.env.clipboard.writeText(endpoint.url);
			});
			copyValueCell.title = 'Copy';
			copyValueCell.iconHeight = '14px';
			copyValueCell.iconWidth = '14px';

			endPointRow.addItem(linkCell, { CSSStyles: { 'width': '62%', 'color': '#0078d4', 'text-decoration': 'underline', 'padding-top': '10px', 'overflow': 'hidden', 'text-overflow': 'ellipsis' } });
			endPointRow.addItem(copyValueCell, { CSSStyles: { 'width': '3%', 'padding-top': '10px' } });

		}


		container.addItem(endPointRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

		const endpointsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '265px', height: '100%', position: 'absolute' }).component();
		endpointsContainer.addItem(container, { CSSStyles: { 'padding-top': '25px', 'padding-left': '5px' } });

		await view.initializeModel(endpointsContainer);
	});
}



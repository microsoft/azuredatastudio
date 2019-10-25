/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { Dataspace } from '../models/dataspace';

export function registerMlEndpointsWidget(context: vscode.ExtensionContext, dataspace: Dataspace): void {
	azdata.ui.registerModelViewProvider('ml-endpoints', async (view) => {
		let settings = dataspace.Settings;
		let mlflow;
		if ('mlflow' in settings) {
			mlflow = settings['mlflow'];
		}

		const container = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '100%', height: '100%' }).component();
		const endPointRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).component();
		const nameCell = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'ML Flow' }).component();
		endPointRow.addItem(nameCell, { CSSStyles: { 'width': '35%', 'font-weight': '600', 'user-select': 'text' } });
		const linkCell = view.modelBuilder.hyperlink()
			.withProperties<azdata.HyperlinkComponentProperties>({
				label: mlflow,
				title: mlflow,
				url: mlflow
			}).component();
		endPointRow.addItem(linkCell, { CSSStyles: { 'width': '62%', 'color': '#0078d4', 'text-decoration': 'underline', 'padding-top': '10px', 'overflow': 'hidden', 'text-overflow': 'ellipsis' } });
		const copyValueCell = view.modelBuilder.button().component();
		copyValueCell.iconPath = { light: context.asAbsolutePath('resources/light/copy.png'), dark: context.asAbsolutePath('resources/dark/copy_inverse.png') };
		copyValueCell.onDidClick(() => {
			vscode.env.clipboard.writeText(mlflow);
		});
		copyValueCell.title = 'Copy';
		copyValueCell.iconHeight = '14px';
		copyValueCell.iconWidth = '14px';
		endPointRow.addItem(copyValueCell, { CSSStyles: { 'width': '3%', 'padding-top': '10px' } });

		container.addItem(endPointRow, { CSSStyles: { 'padding-left': '10px', 'border-top': 'solid 1px #ccc', 'box-sizing': 'border-box', 'user-select': 'text' } });

		const endpointsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '540px', height: '100%', position: 'absolute' }).component();
		endpointsContainer.addItem(container, { CSSStyles: { 'padding-top': '25px', 'padding-left': '5px' } });

		await view.initializeModel(endpointsContainer);
	});
}



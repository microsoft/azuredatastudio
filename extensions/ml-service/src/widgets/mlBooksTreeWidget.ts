/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
const fs = require('fs');
import { TreeDataProvider } from '../notebookTree/treeDataProvider';
import { TreeNode } from '../notebookTree/treeModel';

export function registerMlBooksTreeWidget(extensionContext: vscode.ExtensionContext): void {
	azdata.ui.registerModelViewProvider('ml-bookstree', async (view) => {
		const treeHeight = '500px';
		let container = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			alignItems: 'stretch',
			width: '100%',
			height: '100%'
		}).component();

		let spinner = view.modelBuilder.loadingComponent()
			.withItem(container)
			.withProperties<azdata.LoadingComponentProperties>({ loading: false })
			.component();


		let notebookFolder = path.join(__dirname, '..', '..', 'notebooks');
		// tslint:disable-next-line:no-sync
		let tree = view.modelBuilder.tree().withProperties({
			withCheckbox: false,
			height: treeHeight
		}).component();
		let root = new TreeNode(notebookFolder, 'root', undefined);
		let treeProvider = new TreeDataProvider(root, extensionContext);

		let treeComponentView = tree.registerDataProvider(treeProvider);
		treeComponentView.onDidChangeSelection(async (selectedNodes) => {
			if (selectedNodes && selectedNodes.selection && selectedNodes.selection.length > 0) {
				let notebookPath = selectedNodes.selection[0].data;
				let doc = await vscode.workspace.openTextDocument(notebookPath);
				vscode.window.showTextDocument(doc);
			}
		});
		container.addItem(tree, {
			CSSStyles: {
				'padding-top': '30px',
				'padding-left': '1px',
				'height': treeHeight,
				'width': '540px'
			}
		});

		//treeProvider.notifyRootChanged();
		await view.initializeModel(spinner);
	});
}



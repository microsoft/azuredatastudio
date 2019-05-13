/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class ResourceDeploymentDialog {
	private dialogObject: azdata.window.Dialog;

	constructor() {
		this.dialogObject = azdata.window.createModelViewDialog(localize('deploymentDialog.title', 'Install SQL Server'), 'resourceDeploymentDialog', true);
	}

	private initializeDialog() {
		let tab = azdata.window.createTab('');
		tab.registerContent((view: azdata.ModelView) => {
			let text = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'place holder' }).component();
			return view.initializeModel(text);
		});
		this.dialogObject.content = [tab];
	}

	public open(): void {
		this.initializeDialog();
		azdata.window.openDialog(this.dialogObject);
	}
}

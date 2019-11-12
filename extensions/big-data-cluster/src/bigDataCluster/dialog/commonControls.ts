/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export function createViewDetailsButton(modelBuilder: azdata.ModelBuilder, text: string): azdata.ButtonComponent {
	const viewDetailsButton = modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: localize('bdc.dashboard.viewDetails', "View Details") }).component();
	viewDetailsButton.onDidClick(() => {
		vscode.window.showErrorMessage(text, { modal: true });
	});
	return viewDetailsButton;
}

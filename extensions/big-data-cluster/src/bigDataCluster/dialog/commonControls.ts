/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../localizedConstants';

export function createViewDetailsButton(modelBuilder: azdata.ModelBuilder, text: string): azdata.ButtonComponent {
	const viewDetailsButton = modelBuilder.button().withProperties<azdata.ButtonProperties>({ label: loc.viewDetails, ariaLabel: loc.viewErrorDetails }).component();
	viewDetailsButton.onDidClick(() => {
		vscode.window.showErrorMessage(text, { modal: true });
	});
	return viewDetailsButton;
}

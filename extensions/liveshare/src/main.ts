/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

declare var require: any;
let vsls = require('vsls');

export async function activate(context: vscode.ExtensionContext): Promise<any> {

	vsls.getApi().then((vslsApi) => {
		vscode.window.showErrorMessage('Loaded api');
	});

	vscode.window.showErrorMessage('Unsupported platform');
	return {};
}

export function deactivate(): void {
}

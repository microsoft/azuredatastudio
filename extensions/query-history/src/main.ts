/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// Currently all the functionality for this is contained within the core ADS
	// code as the extensibility API doesn't currently support all the required
	// functionality (such as contributing tab panels)
	vscode.commands.executeCommand('queryHistory.enableQueryHistory');
}

export async function deactivate(): Promise<void> {

}

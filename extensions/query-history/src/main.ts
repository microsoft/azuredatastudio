/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// Currently all the functionality for this is contained within the core ADS
	// code as the extensibility API didn't fully support all the necessary
	vscode.commands.executeCommand('queryHistory.enableQueryHistory');
}

export async function deactivate(): Promise<void> {

}

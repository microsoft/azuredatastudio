/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { findAzdata } from './azdata';

export async function activate(): Promise<void> {
	const outputChannel = vscode.window.createOutputChannel('azdata');
	await checkForAzdata(outputChannel);
}

async function checkForAzdata(outputChannel: vscode.OutputChannel): Promise<void> {
	try {
		await findAzdata(outputChannel);
	} catch (err) {
		// Don't block on this since we want the extension to finish activating without needing user input.
		// Calls will be made to handle azdata not being installed
		promptToInstallAzdata(outputChannel).catch(e => console.log(`Unexpected error prompting to install azdata ${e}`));
	}
}

async function promptToInstallAzdata(_outputChannel: vscode.OutputChannel): Promise<void> {
	//TODO: Figure out better way to display/prompt
	/*
	const response = await vscode.window.showErrorMessage(loc.couldNotFindAzdataWithPrompt, loc.install, loc.cancel);
	if (response === loc.install) {
		try {
			await downloadAndInstallAzdata(outputChannel);
			vscode.window.showInformationMessage(loc.azdataInstalled);
		} catch (err) {
			// Windows: 1602 is User Cancelling installation - not unexpected so don't display
			if (!(err instanceof ExitCodeError) || err.code !== 1602) {
				vscode.window.showWarningMessage(loc.installError(err));
			}
		}
	}
	*/
}

export function deactivate(): void { }

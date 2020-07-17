/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { findAzdata, downloadAndInstallAzdata } from './azdata';
import * as loc from './localizedConstants';
import { ExitCodeError } from './common/childProcess';

export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
	if (extensionContext.extensionMode !== vscode.ExtensionMode.Test) {
		await checkForAzdata();
	}
}

async function checkForAzdata(): Promise<void> {
	const outputChannel = vscode.window.createOutputChannel('azdata');
	try {
		const azdata = await findAzdata(outputChannel);
		vscode.window.showInformationMessage(loc.foundExistingAzdata(azdata.path, azdata.version));
	} catch (err) {
		const response = await vscode.window.showErrorMessage(loc.couldNotFindAzdataWithPrompt, loc.install, loc.cancel);
		if (response === loc.install) {
			try {
				await downloadAndInstallAzdata(outputChannel);
				vscode.window.showInformationMessage(loc.azdataInstalled);
			} catch (err) {
				// 1602 is User Cancelling installation - not unexpected so don't display
				if (!(err instanceof ExitCodeError) || err.code !== 1602) {
					vscode.window.showWarningMessage(loc.installError(err));
				}
			}
		}
	}
}

export function deactivate(): void { }

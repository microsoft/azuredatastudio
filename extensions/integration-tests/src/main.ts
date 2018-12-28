/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { normalize, join } from 'path';
import * as fs from 'fs';
import { waitForCompletion } from './utils';

const TEST_SETUP_COMPLETED_TEXT: string = 'Test Setup Completed';

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand('test.setupIntegrationTest', async (ownerUri: string, providerType: string, templates: Array<sqlops.ProfilerSessionTemplate>) => {
		let extensionInstallersFolder = normalize(join(__dirname, '../extensionInstallers'));
		let installers = fs.readdirSync(extensionInstallersFolder);
		for (let i = 0; i < installers.length; i++) {
			let installerFullPath = join(extensionInstallersFolder, installers[i]);
			await waitForCompletion(sqlops.extensionManagement.install(installerFullPath));
		}
		await setConfiguration('workbench.enablePreviewFeatures', true);
		await setConfiguration('workbench.showConnectDialogOnStartup', false);
		await setConfiguration('test.testSetupCompleted', true);
		let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
		statusBarItem.text = TEST_SETUP_COMPLETED_TEXT;
		statusBarItem.tooltip = TEST_SETUP_COMPLETED_TEXT;
		statusBarItem.show();
	});
}

// this method is called when your extension is deactivated
export function deactivate(): void {

}

async function setConfiguration(name: string, value: any) {
	await waitForCompletion(vscode.workspace.getConfiguration().update(name, value, true));
}

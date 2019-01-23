/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { normalize, join } from 'path';
import * as fs from 'fs';

const TEST_SETUP_COMPLETED_TEXT: string = 'Test Setup Completed';
const EXTENSION_LOADED_TEXT: string = 'Test Extension Loaded';
const ALL_EXTENSION_LOADED_TEXT: string = 'All Extensions Loaded';

var statusBarItemTimer: NodeJS.Timer;

export function activate(context: vscode.ExtensionContext) {
	var statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	vscode.commands.registerCommand('test.setupIntegrationTest', async () => {
		let extensionInstallersFolder = normalize(join(__dirname, '../extensionInstallers'));
		let installers = fs.readdirSync(extensionInstallersFolder);
		for (let i = 0; i < installers.length; i++) {
			if (installers[i].endsWith('.vsix')) {
				let installerFullPath = join(extensionInstallersFolder, installers[i]);
				await sqlops.extensions.install(installerFullPath);
			}
		}
		await setConfiguration('workbench.enablePreviewFeatures', true);
		await setConfiguration('workbench.showConnectDialogOnStartup', false);
		await setConfiguration('test.testSetupCompleted', true);
		showStatusBarItem(statusBarItem, TEST_SETUP_COMPLETED_TEXT);
	});

	vscode.commands.registerCommand('test.waitForExtensionsToLoad', async () => {
		let expectedExtensions = ['Microsoft.agent', 'Microsoft.import', 'Microsoft.mssql', 'Microsoft.profiler'];
		do {
			let extensions = vscode.extensions.all.filter(ext => { return expectedExtensions.indexOf(ext.id) !== -1; });

			let isReady = true;
			for (let i = 0; i < extensions.length; i++) {
				let extension = extensions[i];
				isReady = isReady && extension.isActive;
				if (!isReady) {
					break;
				}
			}

			if (isReady) {
				showStatusBarItem(statusBarItem, ALL_EXTENSION_LOADED_TEXT);
				break;
			} else {
				await new Promise(resolve => { setTimeout(resolve, 1000); });
			}
		}
		while (true);
	});
	showStatusBarItem(statusBarItem, EXTENSION_LOADED_TEXT);
}

function showStatusBarItem(statusBarItem: vscode.StatusBarItem, text: string) {
	statusBarItem.text = text;
	statusBarItem.tooltip = text;
	statusBarItem.show();
	clearTimeout(statusBarItemTimer);
	statusBarItemTimer = setTimeout(function () {
		statusBarItem.hide();
	}, 5000);
}

// this method is called when your extension is deactivated
export function deactivate(): void {

}

async function setConfiguration(name: string, value: any) {
	await vscode.workspace.getConfiguration().update(name, value, true);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { normalize, join } from 'path';
import * as fs from 'fs';

const TEST_SETUP_COMPLETED_TEXT: string = 'Test Setup Completed';
const EXTENSION_LOADED_TEXT: string = 'Test Extension Loaded';
const ALL_EXTENSION_LOADED_TEXT: string = 'All Extensions Loaded';

let statusBarItemTimer: NodeJS.Timer;

export function activate(context: vscode.ExtensionContext) {
	let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	vscode.commands.registerCommand('test.setupIntegrationTest', async () => {
		let extensionInstallersFolder = normalize(join(__dirname, '../extensionInstallers'));
		console.info(`extensionInstallersFolder=${extensionInstallersFolder}`);
		let installers = fs.readdirSync(extensionInstallersFolder);
		for (let i = 0; i < installers.length; i++) {
			if (installers[i].endsWith('.vsix')) {
				let installerFullPath = join(extensionInstallersFolder, installers[i]);
				console.info(`installing extension at ${installerFullPath}`);
				await azdata.extensions.install(installerFullPath);
				console.info(`extension has been installed successfully. vsix: ${installers[i]}`);
			}
		}
		await setConfiguration('workbench.enablePreviewFeatures', true);
		await setConfiguration('workbench.showConnectDialogOnStartup', false);
		await setConfiguration('test.testSetupCompleted', true);
		showStatusBarItem(statusBarItem, TEST_SETUP_COMPLETED_TEXT);
	});

	vscode.commands.registerCommand('test.waitForExtensionsToLoad', async () => {
		const expectedExtensions = ['Microsoft.agent', 'Microsoft.import', 'Microsoft.mssql', 'Microsoft.profiler', 'Microsoft.azuredatastudio-postgresql'];
		const commonFeatures: azdata.DataProviderType[] = [
			azdata.DataProviderType.AdminServicesProvider,
			azdata.DataProviderType.BackupProvider,
			azdata.DataProviderType.CapabilitiesProvider,
			azdata.DataProviderType.ConnectionProvider,
			azdata.DataProviderType.FileBrowserProvider,
			azdata.DataProviderType.MetadataProvider,
			azdata.DataProviderType.ObjectExplorerProvider,
			azdata.DataProviderType.ProfilerProvider,
			azdata.DataProviderType.QueryProvider,
			azdata.DataProviderType.RestoreProvider,
			azdata.DataProviderType.ScriptingProvider,
			azdata.DataProviderType.TaskServicesProvider];

		const features_mssql: azdata.DataProviderType[] = [
			azdata.DataProviderType.AgentServicesProvider,
			azdata.DataProviderType.IconProvider
		];

		features_mssql.push(...commonFeatures);

		const providerFeatureMapping: { providerId: string, features: azdata.DataProviderType[] }[] = [
			{
				providerId: 'MSSQL',
				features: features_mssql
			}, {
				providerId: 'PGSQL',
				features: commonFeatures
			}];

		do {
			let extensions = vscode.extensions.all.filter(ext => { return expectedExtensions.indexOf(ext.id) !== -1; });
			const extensionsNotInReadyState: string[] = [];

			extensions.forEach(extension => {
				if (!extension.isActive) {
					extensionsNotInReadyState.push(extension.id);
				}
			});

			const providerTypesNotInReadyState: string[] = [];
			if (extensionsNotInReadyState.length === 0) {
				providerFeatureMapping.forEach(entry => {
					entry.features.forEach(feature => {
						const provider = azdata.dataprotocol.getProvider(entry.providerId, feature);
						if (!provider) {
							providerTypesNotInReadyState.push(`${entry.providerId}:${feature}`);
						}
					});
				});
			}

			if (extensionsNotInReadyState.length === 0 && providerTypesNotInReadyState.length === 0) {
				console.info('All extensions are ready');
				showStatusBarItem(statusBarItem, ALL_EXTENSION_LOADED_TEXT);
				break;
			} else if (extensionsNotInReadyState.length !== 0) {
				console.warn(`the following extensions are not ready: ${extensionsNotInReadyState.join(',')}`);
			} else {
				console.warn(`the following providers are not ready: ${providerTypesNotInReadyState.join(',')}`);
			}
			await new Promise(resolve => { setTimeout(resolve, 2000); });
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

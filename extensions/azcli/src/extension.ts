/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { getExtensionApi } from './api';
import { checkAndInstallAzdata, checkAndUpdateAzdata, findAzdata, isEulaAccepted, promptForEula } from './azdata';
import Logger from './common/logger';
import * as constants from './constants';
import * as loc from './localizedConstants';
import { AzdataToolService } from './services/azdataToolService';

export async function activate(context: vscode.ExtensionContext): Promise<azdataExt.IExtension> {
	const azdataToolService = new AzdataToolService();
	let eulaAccepted: boolean = false;
	vscode.commands.registerCommand('azcli.acceptEula', async () => {
		await promptForEula(context.globalState, true /* userRequested */);
	});

	vscode.commands.registerCommand('azcli.install', async () => {
		azdataToolService.localAzdata = await checkAndInstallAzdata(true /* userRequested */);
	});

	vscode.commands.registerCommand('azcli.update', async () => {
		if (await checkAndUpdateAzdata(azdataToolService.localAzdata, true /* userRequested */)) { // if an update was performed
			azdataToolService.localAzdata = await findAzdata(); // find and save the currently installed azdata
		}
	});

	eulaAccepted = isEulaAccepted(context.globalState); // fetch eula acceptance state from memento
	await vscode.commands.executeCommand('setContext', constants.eulaAccepted, eulaAccepted); // set a context key for current value of eulaAccepted state retrieved from memento so that command for accepting eula is available/unavailable in commandPalette appropriately.
	Logger.log(loc.eulaAcceptedStateOnStartup(eulaAccepted));

	// Don't block on this since we want the extension to finish activating without needing user input
	const localAzdataDiscovered = checkAndInstallAzdata() // install if not installed and user wants it.
		.then(async azdataTool => {
			if (azdataTool !== undefined) {
				azdataToolService.localAzdata = azdataTool;
				if (!eulaAccepted) {
					// Don't block on this since we want extension to finish activating without requiring user actions.
					// If EULA has not been accepted then we will check again while executing azdata commands.
					promptForEula(context.globalState)
						.then(async (userResponse: boolean) => {
							eulaAccepted = userResponse;
						})
						.catch((err) => console.log(err));
				}
				try {
					//update if available and user wants it.
					if (await checkAndUpdateAzdata(azdataToolService.localAzdata)) { // if an update was performed
						azdataToolService.localAzdata = await findAzdata(); // find and save the currently installed azdata
					}
				} catch (err) {
					vscode.window.showWarningMessage(loc.updateError(err));
				}
			}
			return azdataTool;
		});

	const azdataApi = getExtensionApi(context.globalState, azdataToolService, localAzdataDiscovered);

	// register option source(s)
	// TODO: Uncomment this once azdata extension is removed
	// const rdApi = <rd.IExtension>vscode.extensions.getExtension(rd.extension.name)?.exports;
	// context.subscriptions.push(rdApi.registerOptionsSourceProvider(new ArcControllerConfigProfilesOptionsSource(azdataApi)));

	return azdataApi;
}

export function deactivate(): void { }

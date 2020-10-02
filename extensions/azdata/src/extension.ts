/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as rd from 'resource-deployment';
import * as vscode from 'vscode';
import { getExtensionApi } from './api';
import { checkAndInstallAzdata, checkAndUpdateAzdata, findAzdata, IAzdataTool, promptForEula } from './azdata';
import Logger from './common/logger';
import * as constants from './constants';
import * as loc from './localizedConstants';
import { ArcControllerConfigProfilesOptionsSource } from './providers/arcControllerConfigProfilesOptionsSource';

let localAzdata: IAzdataTool | undefined = undefined;
let localAzdataDiscovered: Promise<void> | undefined = undefined;
let eulaAccepted: boolean = false;
export async function activate(context: vscode.ExtensionContext): Promise<azdataExt.IExtension> {
	vscode.commands.registerCommand('azdata.acceptEula', async () => {
		eulaAccepted = await promptForEula(context.globalState, true /* userRequested */);

	});

	vscode.commands.registerCommand('azdata.install', async () => {
		localAzdata = await checkAndInstallAzdata(true /* userRequested */);
	});

	vscode.commands.registerCommand('azdata.update', async () => {
		if (await checkAndUpdateAzdata(localAzdata, true /* userRequested */)) { // if an update was performed
			localAzdata = await findAzdata(); // find and save the currently installed azdata
		}
	});

	eulaAccepted = !!context.globalState.get<boolean>(constants.eulaAccepted); // fetch eula acceptance state from memento
	await vscode.commands.executeCommand('setContext', constants.eulaAccepted, eulaAccepted); // set a context key for current value of eulaAccepted state retrieved from memento so that command for accepting eula is available/unavailable in commandPalette appropriately.
	Logger.log(loc.eulaAcceptedStateOnStartup(eulaAccepted));

	// Don't block on this since we want the extension to finish activating without needing user input
	localAzdataDiscovered = checkAndInstallAzdata() // install if not installed and user wants it.
		.then(async azdataTool => {
			localAzdata = azdataTool;
			if (localAzdata !== undefined) {
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
					if (await checkAndUpdateAzdata(localAzdata)) { // if an update was performed
						localAzdata = await findAzdata(); // find and save the currently installed azdata
					}
				} catch (err) {
					vscode.window.showWarningMessage(loc.updateError(err));
				}
			}
		});

	// register option source(s)
	const rdApi = <rd.IExtension>await vscode.extensions.getExtension(rd.extension.name)?.activate();
	rdApi.registerOptionsSourceProvider(new ArcControllerConfigProfilesOptionsSource(localAzdata!));

	return getExtensionApi(context, localAzdata, eulaAccepted, localAzdataDiscovered);
}

export function deactivate(): void { }

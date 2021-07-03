/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as rd from 'resource-deployment';
import * as vscode from 'vscode';
import { getExtensionApi } from './api';
import { isEulaAccepted, promptForEula } from './azdata';
import Logger from './common/logger';
import * as constants from './constants';
import * as loc from './localizedConstants';
import { ArcControllerConfigProfilesOptionsSource } from './providers/arcControllerConfigProfilesOptionsSource';
import { AzdataToolService } from './services/azdataToolService';

export async function activate(context: vscode.ExtensionContext): Promise<azdataExt.IExtension> {
	const azdataToolService = new AzdataToolService();
	let eulaAccepted: boolean = false;
	vscode.commands.registerCommand('azdata.acceptEula', async () => {
		await promptForEula(context.globalState, true /* userRequested */);
	});

	eulaAccepted = isEulaAccepted(context.globalState); // fetch eula acceptance state from memento
	await vscode.commands.executeCommand('setContext', constants.eulaAccepted, eulaAccepted); // set a context key for current value of eulaAccepted state retrieved from memento so that command for accepting eula is available/unavailable in commandPalette appropriately.
	Logger.log(loc.eulaAcceptedStateOnStartup(eulaAccepted));

	const azdataApi = getExtensionApi(context.globalState, azdataToolService);

	// register option source(s)
	const rdApi = <rd.IExtension>vscode.extensions.getExtension(rd.extension.name)?.exports;
	context.subscriptions.push(rdApi.registerOptionsSourceProvider(new ArcControllerConfigProfilesOptionsSource(azdataApi)));

	return azdataApi;
}

export function deactivate(): void { }

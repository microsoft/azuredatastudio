/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { findAzdata, IAzdataTool, manuallyInstallOrUpgradeAzdata, promptForEula } from './azdata';
import Logger from './common/logger';
import * as constants from './constants';
import * as loc from './localizedConstants';

let localAzdata: IAzdataTool | undefined = undefined;
let eulaAccepted: boolean = false;

export async function activate(context: vscode.ExtensionContext): Promise<azdataExt.IExtension> {
	localAzdata = await checkForAzdata();
	eulaAccepted = !!context.globalState.get(constants.acceptEula);
	if (!eulaAccepted) {
		// Don't block on this since we want extension to finish activating without requiring user actions.
		// If EULA has not been accepted then we will check again while executing azdata commands.
		promptForEula(context.globalState).then(userResponse => {
			eulaAccepted = userResponse;
		});
	}
	// Don't block on this since we want the extension to finish activating without user actions
	manuallyInstallOrUpgradeAzdata(context, localAzdata)
		.catch(err => console.log(err));
	return {
		azdata: {
			arc: {
				dc: {
					create: async (namespace: string, name: string, connectivityMode: string, resourceGroup: string, location: string, subscription: string, profileName?: string, storageClass?: string) => {
						await throwIfNoAzdataOrEulaNotAccepted(context);
						return localAzdata!.arc.dc.create(namespace, name, connectivityMode, resourceGroup, location, subscription, profileName, storageClass);
					},
					endpoint: {
						list: async () => {
							await throwIfNoAzdataOrEulaNotAccepted(context);
							return localAzdata!.arc.dc.endpoint.list();
						}
					},
					config: {
						list: async () => {
							await throwIfNoAzdataOrEulaNotAccepted(context);
							return localAzdata!.arc.dc.config.list();
						},
						show: async () => {
							await throwIfNoAzdataOrEulaNotAccepted(context);
							return localAzdata!.arc.dc.config.show();
						}
					}
				},
				postgres: {
					server: {
						list: async () => {
							await throwIfNoAzdataOrEulaNotAccepted(context);
							return localAzdata!.arc.postgres.server.list();
						},
						show: async (name: string) => {
							await throwIfNoAzdataOrEulaNotAccepted(context);
							return localAzdata!.arc.postgres.server.show(name);
						}
					}
				},
				sql: {
					mi: {
						delete: async (name: string) => {
							await throwIfNoAzdataOrEulaNotAccepted(context);
							return localAzdata!.arc.sql.mi.delete(name);
						},
						list: async () => {
							await throwIfNoAzdataOrEulaNotAccepted(context);
							return localAzdata!.arc.sql.mi.list();
						},
						show: async (name: string) => {
							await throwIfNoAzdataOrEulaNotAccepted(context);
							return localAzdata!.arc.sql.mi.show(name);
						}
					}
				}
			},
			login: async (endpoint: string, username: string, password: string) => {
				await await throwIfNoAzdataOrEulaNotAccepted(context);
				return localAzdata!.login(endpoint, username, password);
			},
			version: async () => {
				await throwIfNoAzdataOrEulaNotAccepted(context);
				return localAzdata!.version();
			}
		}
	};
}

async function throwIfNoAzdataOrEulaNotAccepted(context: vscode.ExtensionContext): Promise<void> {
	if (!localAzdata) {
		throw new Error(loc.noAzdata);
	}
	if (!eulaAccepted) {
		eulaAccepted = await promptForEula(context.globalState);
	}
	if (!eulaAccepted) {
		Logger.log(loc.eulaNotAccepted);
		throw new Error(loc.eulaNotAccepted);
	}
}

async function checkForAzdata(): Promise<IAzdataTool | undefined> {
	try {
		return await findAzdata(); // find currently installed Azdata
	} catch (err) {
		// Don't block on this since we want the extension to finish activating without needing user input.
		// Calls will be made to handle azdata not being installed
		await promptToInstallAzdata().catch(e => console.log(`Unexpected error prompting to install azdata ${e}`));
	}
	return undefined;
}

async function promptToInstallAzdata(): Promise<void> {
	//TODO: Figure out better way to display/prompt
	/*
	const response = await vscode.window.showErrorMessage(loc.couldNotFindAzdataWithPrompt, loc.install, loc.cancel);
	if (response === loc.install) {
		try {
			await downloadAndInstallAzdata();
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

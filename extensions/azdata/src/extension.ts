/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { checkAndInstallAzdata, checkAndUpdateAzdata, findAzdata, IAzdataTool, promptForEula } from './azdata';
import Logger from './common/logger';
import * as constants from './constants';
import * as loc from './localizedConstants';

let localAzdata: IAzdataTool | undefined = undefined;
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
	if (!eulaAccepted) {
		// Don't block on this since we want extension to finish activating without requiring user actions.
		// If EULA has not been accepted then we will check again while executing azdata commands.
		promptForEula(context.globalState)
			.then(async (userResponse: boolean) => {
				eulaAccepted = userResponse;
			})
			.catch((err) => console.log(err));
	}

	// Don't block on this since we want the extension to finish activating without needing user input
	checkAndInstallAzdata() // install if not installed and user wants it.
		.then(async azdataTool => {
			localAzdata = azdataTool;
			if (localAzdata !== undefined) {
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

	return {
		azdata: {
			arc: {
				dc: {
					create: async (namespace: string, name: string, connectivityMode: string, resourceGroup: string, location: string, subscription: string, profileName?: string, storageClass?: string) => {
						await throwIfNoAzdataOrEulaNotAccepted();
						return localAzdata!.arc.dc.create(namespace, name, connectivityMode, resourceGroup, location, subscription, profileName, storageClass);
					},
					endpoint: {
						list: async () => {
							await throwIfNoAzdataOrEulaNotAccepted();
							return localAzdata!.arc.dc.endpoint.list();
						}
					},
					config: {
						list: async () => {
							await throwIfNoAzdataOrEulaNotAccepted();
							return localAzdata!.arc.dc.config.list();
						},
						show: async () => {
							await throwIfNoAzdataOrEulaNotAccepted();
							return localAzdata!.arc.dc.config.show();
						}
					}
				},
				postgres: {
					server: {
						list: async () => {
							await throwIfNoAzdataOrEulaNotAccepted();
							return localAzdata!.arc.postgres.server.list();
						},
						show: async (name: string) => {
							await throwIfNoAzdataOrEulaNotAccepted();
							return localAzdata!.arc.postgres.server.show(name);
						}
					}
				},
				sql: {
					mi: {
						delete: async (name: string) => {
							await throwIfNoAzdataOrEulaNotAccepted();
							return localAzdata!.arc.sql.mi.delete(name);
						},
						list: async () => {
							await throwIfNoAzdataOrEulaNotAccepted();
							return localAzdata!.arc.sql.mi.list();
						},
						show: async (name: string) => {
							await throwIfNoAzdataOrEulaNotAccepted();
							return localAzdata!.arc.sql.mi.show(name);
						}
					}
				}
			},
			login: async (endpoint: string, username: string, password: string) => {
				await throwIfNoAzdataOrEulaNotAccepted();
				return localAzdata!.login(endpoint, username, password);
			},
			version: async () => {
				await throwIfNoAzdataOrEulaNotAccepted();
				return localAzdata!.version();
			}
		}
	};
}

async function throwIfNoAzdataOrEulaNotAccepted(): Promise<void> {
	if (!localAzdata) {
		Logger.log(loc.noAzdata);
		throw new Error(loc.noAzdata);
	}
	if (!eulaAccepted) {
		Logger.log(loc.eulaNotAccepted);
		throw new Error(loc.eulaNotAccepted);
	}
}

export function deactivate(): void { }

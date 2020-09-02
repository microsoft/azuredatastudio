/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { checkAndInstallAzdata, checkAndUpgradeAzdata, findAzdata, IAzdataTool, promptForEula } from './azdata';
import Logger from './common/logger';
import * as constants from './constants';
import * as loc from './localizedConstants';

let localAzdata: IAzdataTool | undefined = undefined;
let eulaAccepted: boolean = false;

export async function activate(context: vscode.ExtensionContext): Promise<azdataExt.IExtension> {
	vscode.commands.registerCommand('azdata.acceptEula', async () => {
		eulaAccepted = await promptForEula(context.globalState, true /* userRequested */);
		await vscode.commands.executeCommand('setContext', 'azdata.eulaAccepted', eulaAccepted);
	});

	vscode.commands.registerCommand('azdata.install', async () => {
		await checkAndInstallAzdata(true);
	});



	vscode.commands.registerCommand('azdata.upgrade', async () => {
		if (await checkAndUpgradeAzdata(localAzdata, true /* userRequested */)) { // if an upgrade was performed
			localAzdata = await findAzdata(); // find and save the currently installed azdata
		}
	});

	// Don't block on this since we want the extension to finish activating without needing user input
	checkAndInstallAzdata() // install if not installed and user wants it.
		.then(async azdataTool => {
			localAzdata = azdataTool;
			if (localAzdata !== undefined) {
				await vscode.commands.executeCommand('setContext', 'azdata.found', true /* userRequested */);
				try {
					//update if available and user wants it.
					if (await checkAndUpgradeAzdata(localAzdata)) { // if an upgrade was performed
						localAzdata = await findAzdata(); // find and save the currently installed azdata
					}
				} catch (err) {
					vscode.window.showWarningMessage(loc.upgradeError(err));
				}
			}
		});

	eulaAccepted = !!context.globalState.get<boolean>(constants.acceptEula);
	if (!eulaAccepted) {
		// Don't block on this since we want extension to finish activating without requiring user actions.
		// If EULA has not been accepted then we will check again while executing azdata commands.
		promptForEula(context.globalState)
			.then(async (userResponse: boolean) => {
				eulaAccepted = userResponse;
				await vscode.commands.executeCommand('setContext', 'azdata.eulaAccepted', true);
			})
			.catch((err: any) => console.log(err));
	}
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
				await throwIfNoAzdataOrEulaNotAccepted(context);
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

export function deactivate(): void { }

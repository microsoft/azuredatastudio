/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { checkAndUpgradeAzdata, findAzdata, IAzdataTool } from './azdata';
import * as loc from './localizedConstants';

let localAzdata: IAzdataTool | undefined = undefined;

export async function activate(): Promise<azdataExt.IExtension> {
	localAzdata = await checkForAzdata();
	// Don't block on this since we want the extension to finish activating without needing user input
	// upgrade if available and user wants it.
	checkAndUpgradeAzdata(localAzdata)
		.then(async upgradePerformed => {
			try {
				if (upgradePerformed) { // If upgrade was performed then find the new azdata and save the new azdata
					localAzdata = await findAzdata();
				}
			} catch (_err) {
				//Do nothing, it is expected that if user did not accept upgrade of azdata then findAzdata will still fail throwing an error.
			}
		})
		.catch(err => vscode.window.showWarningMessage(loc.upgradeError(err)));
	return {
		azdata: {
			arc: {
				dc: {
					create: async (namespace: string, name: string, connectivityMode: string, resourceGroup: string, location: string, subscription: string, profileName?: string, storageClass?: string) => {
						throwIfNoAzdata();
						return localAzdata!.arc.dc.create(namespace, name, connectivityMode, resourceGroup, location, subscription, profileName, storageClass);
					},
					endpoint: {
						list: async () => {
							throwIfNoAzdata();
							return localAzdata!.arc.dc.endpoint.list();
						}
					},
					config: {
						list: async () => {
							throwIfNoAzdata();
							return localAzdata!.arc.dc.config.list();
						},
						show: async () => {
							throwIfNoAzdata();
							return localAzdata!.arc.dc.config.show();
						}
					}
				},
				postgres: {
					server: {
						list: async () => {
							throwIfNoAzdata();
							return localAzdata!.arc.postgres.server.list();
						},
						show: async (name: string) => {
							throwIfNoAzdata();
							return localAzdata!.arc.postgres.server.show(name);
						}
					}
				},
				sql: {
					mi: {
						delete: async (name: string) => {
							throwIfNoAzdata();
							return localAzdata!.arc.sql.mi.delete(name);
						},
						list: async () => {
							throwIfNoAzdata();
							return localAzdata!.arc.sql.mi.list();
						},
						show: async (name: string) => {
							throwIfNoAzdata();
							return localAzdata!.arc.sql.mi.show(name);
						}
					}
				}
			},
			login: async (endpoint: string, username: string, password: string) => {
				throwIfNoAzdata();
				return localAzdata!.login(endpoint, username, password);
			},
			version: async () => {
				throwIfNoAzdata();
				return localAzdata!.version();
			}
		}
	};
}

function throwIfNoAzdata(): void {
	if (!localAzdata) {
		throw new Error(loc.noAzdata);
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

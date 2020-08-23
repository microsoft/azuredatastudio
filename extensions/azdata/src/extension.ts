/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { findAzdata, IAzdataTool } from './azdata';
import * as loc from './localizedConstants';

let localAzdata: IAzdataTool | undefined = undefined;

export async function activate(): Promise<azdataExt.IExtension> {
	const outputChannel = vscode.window.createOutputChannel('azdata');
	localAzdata = await checkForAzdata(outputChannel);
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

async function checkForAzdata(outputChannel: vscode.OutputChannel): Promise<IAzdataTool | undefined> {
	try {
		return await findAzdata(outputChannel);
	} catch (err) {
		// Don't block on this since we want the extension to finish activating without needing user input.
		// Calls will be made to handle azdata not being installed
		promptToInstallAzdata(outputChannel).catch(e => console.log(`Unexpected error prompting to install azdata ${e}`));
	}
	return undefined;
}

async function promptToInstallAzdata(_outputChannel: vscode.OutputChannel): Promise<void> {
	//TODO: Figure out better way to display/prompt
	/*
	const response = await vscode.window.showErrorMessage(loc.couldNotFindAzdataWithPrompt, loc.install, loc.cancel);
	if (response === loc.install) {
		try {
			await downloadAndInstallAzdata(outputChannel);
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

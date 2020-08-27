/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { checkAndInstallAzdata, checkAndUpgradeAzdata, findAzdata, IAzdataTool } from './azdata';
import Logger from './common/logger';
import * as loc from './localizedConstants';

let localAzdata: IAzdataTool | undefined = undefined;

export async function activate(): Promise<azdataExt.IExtension> {
	await vscode.commands.executeCommand('setContext', 'config.deployment.azdataFound', false);

	vscode.commands.registerCommand('azdata.install', async () => {
		await checkAndInstallAzdata(true);
	});

	vscode.commands.registerCommand('azdata.upgrade', async () => {
		const currentAzdata = await findAzdata();
		if (currentAzdata !== undefined) {
			await checkAndUpgradeAzdata(currentAzdata, true);
		} else {
			vscode.window.showErrorMessage(loc.notFoundExistingAzdata);
			Logger.log(loc.notFoundExistingAzdata);
		}
	});

	// Don't block on this since we want the extension to finish activating without needing user input
	checkAndInstallAzdata() // install if not installed and user wants it.
		.then(async azdataTool => {
			localAzdata = azdataTool;
			if (localAzdata !== undefined) {
				await vscode.commands.executeCommand('setContext', 'config.deployment.azdataFound', true);
				try {
					await checkAndUpgradeAzdata(localAzdata); //update if available and user wants it.
					localAzdata = await findAzdata(); // now again find and save the currently installed azdata
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

export function deactivate(): void { }

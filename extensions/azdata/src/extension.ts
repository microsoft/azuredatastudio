/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as vscode from 'vscode';
import { checkAndInstallAzdata, checkAndUpgradeAzdata, findAzdata, IAzdataTool } from './azdata';
import * as loc from './localizedConstants';

let localAzdata: IAzdataTool | undefined = undefined;

export async function activate(): Promise<azdataExt.IExtension> {
	const outputChannel = vscode.window.createOutputChannel('azdata');
	await vscode.commands.executeCommand('setContext', 'config.deployment.azdataFound', false);
	vscode.commands.registerCommand('azdata.install', async () => {
		await checkAndInstallAzdata(outputChannel, true);
	});

	vscode.commands.registerCommand('azdata.upgrade', async () => {
		const currentAzdata = await findAzdata(outputChannel);
		if (currentAzdata !== undefined) {
			checkAndUpgradeAzdata(currentAzdata, outputChannel, true);
		} else {
			vscode.window.showErrorMessage(loc.notFoundExistingAzdata);
			outputChannel.appendLine(loc.notFoundExistingAzdata);
		}
	});

	checkAndInstallAzdata(outputChannel).then(async azdataTool => {
		localAzdata = azdataTool;
		if (localAzdata !== undefined) {
			await vscode.commands.executeCommand('setContext', 'config.deployment.azdataFound', true);
		}
	});
	return {
		dc: {
			endpoint: {
				list: async () => {
					return executeLocalAzdataCommand(['arc', 'dc', 'endpoint', 'list']);
				}
			},
			config: {
				show: async () => {
					return executeLocalAzdataCommand(['arc', 'dc', 'config', 'show']);
				}
			}
		},
		login: async (endpoint: string, username: string, password: string) => {
			return executeLocalAzdataCommand(['login', '-e', endpoint, '-u', username], { 'AZDATA_PASSWORD': password });
		},
		postgres: {
			server: {
				list: async () => {
					return executeLocalAzdataCommand(['arc', 'postgres', 'server', 'list']);
				},
				show: async (name: string) => {
					return executeLocalAzdataCommand(['arc', 'postgres', 'server', 'show', '-n', name]);
				}
			}
		},
		sql: {
			mi: {
				delete: async (name: string) => {
					return executeLocalAzdataCommand(['arc', 'sql', 'mi', 'delete', '-n', name]);
				},
				list: async () => {
					return executeLocalAzdataCommand(['arc', 'sql', 'mi', 'list']);
				},
				show: async (name: string) => {
					return executeLocalAzdataCommand(['arc', 'sql', 'mi', 'show', '-n', name]);
				}
			}
		}
	};
}

async function executeLocalAzdataCommand<R>(args: string[], additionalEnvVars?: { [key: string]: string }): Promise<azdataExt.AzdataOutput<R>> {
	if (!localAzdata) {
		throw new Error('No azdata');
	}
	return localAzdata.executeCommand(args, additionalEnvVars);
}

export function deactivate(): void { }

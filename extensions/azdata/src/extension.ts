/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { checkAndInstallAzdata, checkAndUpgradeAzdata, findAzdata, IAzdataTool } from './azdata';
import { parsePostgresServerListResult, parseSqlInstanceListResult } from './common/azdataUtils';
import * as loc from './localizedConstants';
import * as azdata from './typings/azdata-ext';

let localAzdata: IAzdataTool | undefined = undefined;


export async function activate(): Promise<azdata.IExtension> {
	const outputChannel = vscode.window.createOutputChannel('azdata');
	vscode.commands.registerCommand('azdata.install', () => {
		checkAndInstallAzdata(outputChannel, true);
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

	localAzdata = await checkAndInstallAzdata(outputChannel);
	return {
		postgres: {
			server: {
				list: async () => {
					if (!localAzdata) {
						throw new Error('No azdata');
					}
					return localAzdata.executeCommand(['postgres', 'server', 'list'], parsePostgresServerListResult);
				}
			}
		},
		sql: {
			instance: {
				list: async () => {
					if (!localAzdata) {
						throw new Error('No azdata');
					}
					return localAzdata.executeCommand(['sql', 'instance', 'list'], parseSqlInstanceListResult);
				}
			}
		}
	};
}

export function deactivate(): void { }

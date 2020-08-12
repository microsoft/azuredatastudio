/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from './typings/azdata-ext';
import * as vscode from 'vscode';
import { findAzdata, IAzdataTool } from './azdata';
import { parsePostgresServerListResult, parseSqlInstanceListResult } from './common/azdataUtils';

let localAzdata: IAzdataTool | undefined = undefined;

export async function activate(): Promise<azdata.IExtension> {
	const outputChannel = vscode.window.createOutputChannel('azdata');
	localAzdata = await checkForAzdata(outputChannel);
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

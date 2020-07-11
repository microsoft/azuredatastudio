/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DataTierApplicationWizard } from './wizard/dataTierApplicationWizard';

export async function activate(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand('dacFx.start', (profile: azdata.IConnectionProfile, ...args: any[]) => new DataTierApplicationWizard().start(profile, args));
}

export function deactivate(): void {
}

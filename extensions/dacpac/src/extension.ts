/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DataTierApplicationWizard } from './wizard/dataTierApplicationWizard';
import { TelemetryReporter } from './telemetry';

export async function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('dacFx.start', (profile: azdata.IConnectionProfile) => new DataTierApplicationWizard(undefined, context).start(profile)));
	context.subscriptions.push(TelemetryReporter);
}

export function deactivate(): void {
}

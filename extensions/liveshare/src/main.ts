/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { GuestSessionManager } from './guestSessionManager';
import { HostSessionManager } from './hostSessionManager';

declare let require: any;
let vsls = require('vsls');

export async function activate(context: vscode.ExtensionContext) {
	const vslsApi = await vsls.getApi();
	if (!vslsApi) {
		return;
	}

	new HostSessionManager(context, vslsApi);
	new GuestSessionManager(context, vslsApi);
}

export function deactivate(): void {
}

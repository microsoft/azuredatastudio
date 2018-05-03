/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as os from 'os';

import * as constants from './constants';
import { AzureAccountProviderService } from './account-provider/azureAccountProviderService';

// The function is a duplicate of \src\paths.js. IT would be better to import path.js but it doesn't
// work for now because the extension is running in different process.
export function getAppDataPath() {
	var platform = process.platform;
	switch (platform) {
		case 'win32': return process.env['APPDATA'] || path.join(process.env['USERPROFILE'], 'AppData', 'Roaming');
		case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support');
		case 'linux': return process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
		default: throw new Error('Platform not supported');
	}
}

export function getDefaultLogLocation() {
	return path.join(getAppDataPath(), 'sqlops');
}

// EXTENSION ACTIVATION ////////////////////////////////////////////////////
export function activate(context: vscode.ExtensionContext): void {
	// Create the folder for storing the token caches
	let storagePath = path.join(getDefaultLogLocation(), constants.extensionName);
	try {
		if (!fs.existsSync(storagePath)) {
			fs.mkdirSync(storagePath);
			console.log('Initialized Azure account extension storage.');
		}
	} catch (e) {
		console.error(`Initialization of Azure account extension storage failed: ${e}`);
		console.error('Azure accounts will not be available');
		return;
	}

	// Create the provider service and activate
	const accountProviderService = new AzureAccountProviderService(context, storagePath);
	context.subscriptions.push(accountProviderService);
	accountProviderService.activate();
}

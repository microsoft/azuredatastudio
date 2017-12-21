/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Utils } from 'extensions-modules';

import * as constants from './constants';
import { AzureAccountProviderService } from './account-provider/azureAccountProviderService';

// EXTENSION ACTIVATION ////////////////////////////////////////////////////
export function activate(context: vscode.ExtensionContext): void {
	// Create the folder for storing the token caches
	let storagePath = path.join(Utils.getDefaultLogLocation(), constants.extensionName);
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

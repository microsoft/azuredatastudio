/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as constants from './constants';

import { AppContext } from './appContext';
import { ApiWrapper } from './apiWrapper';
import { AzureAccountProviderService } from './account-provider/azureAccountProviderService';

import { AzureResourceDatabaseServerProvider } from './azureResource/providers/databaseServer/databaseServerProvider';
import { AzureResourceDatabaseServerService } from './azureResource/providers/databaseServer/databaseServerService';
import { AzureResourceDatabaseProvider } from './azureResource/providers/database/databaseProvider';
import { AzureResourceDatabaseService } from './azureResource/providers/database/databaseService';
import { AzureResourceService } from './azureResource/resourceService';
import { IAzureResourceCacheService, IAzureResourceAccountService, IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService, IAzureResourceTenantService } from './azureResource/interfaces';
import { AzureResourceServiceNames } from './azureResource/constants';
import { AzureResourceAccountService } from './azureResource/services/accountService';
import { AzureResourceSubscriptionService } from './azureResource/services/subscriptionService';
import { AzureResourceSubscriptionFilterService } from './azureResource/services/subscriptionFilterService';
import { AzureResourceCacheService } from './azureResource/services/cacheService';
import { AzureResourceTenantService } from './azureResource/services/tenantService';
import { registerAzureResourceCommands } from './azureResource/commands';
import { registerAzureResourceDatabaseServerCommands } from './azureResource/providers/databaseServer/commands';
import { registerAzureResourceDatabaseCommands } from './azureResource/providers/database/commands';
import { AzureResourceTreeProvider } from './azureResource/tree/treeProvider';

let extensionContext: vscode.ExtensionContext;

// The function is a duplicate of \src\paths.js. IT would be better to import path.js but it doesn't
// work for now because the extension is running in different process.
export function getAppDataPath() {
	let platform = process.platform;
	switch (platform) {
		case 'win32': return process.env['APPDATA'] || path.join(process.env['USERPROFILE'], 'AppData', 'Roaming');
		case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support');
		case 'linux': return process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
		default: throw new Error('Platform not supported');
	}
}

export function getDefaultLogLocation() {
	return path.join(getAppDataPath(), 'azuredatastudio');
}

function pushDisposable(disposable: vscode.Disposable): void {
	extensionContext.subscriptions.push(disposable);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	extensionContext = context;
	const apiWrapper = new ApiWrapper();
	let appContext = new AppContext(extensionContext, apiWrapper);

	let storagePath = await findOrMakeStoragePath();
	if (!storagePath) {
		return undefined;
	}

	// Create the provider service and activate
	initAzureAccountProvider(extensionContext, storagePath);

	registerAzureServices(appContext);
	const azureResourceTree = new AzureResourceTreeProvider(appContext);
	pushDisposable(apiWrapper.registerTreeDataProvider('azureResourceExplorer', azureResourceTree));
	registerCommands(appContext, azureResourceTree);

	return {
		provideResources() {
			return [
				new AzureResourceDatabaseServerProvider(new AzureResourceDatabaseServerService(), apiWrapper, extensionContext),
				new AzureResourceDatabaseProvider(new AzureResourceDatabaseService(), apiWrapper, extensionContext)
			];
		}
	};
}

async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch (e) {
		return false;
	}
}

// Create the folder for storing the token caches
async function findOrMakeStoragePath() {
	let storagePath = path.join(getDefaultLogLocation(), constants.extensionName);
	try {
		if (!(await exists(storagePath))) {
			await fs.mkdir(storagePath);
			console.log('Initialized Azure account extension storage.');
		}
	}
	catch (e) {
		console.error(`Initialization of Azure account extension storage failed: ${e}`);
		console.error('Azure accounts will not be available');
	}
	return storagePath;
}

async function initAzureAccountProvider(extensionContext: vscode.ExtensionContext, storagePath: string): Promise<void> {
	try {
		const accountProviderService = new AzureAccountProviderService(extensionContext, storagePath);
		extensionContext.subscriptions.push(accountProviderService);
		await accountProviderService.activate();
	} catch (err) {
		console.log('Unexpected error starting account provider: ' + err.message);
	}
}

function registerAzureServices(appContext: AppContext): void {
	appContext.registerService<AzureResourceService>(AzureResourceServiceNames.resourceService, new AzureResourceService());
	appContext.registerService<IAzureResourceAccountService>(AzureResourceServiceNames.accountService, new AzureResourceAccountService(appContext.apiWrapper));
	appContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, new AzureResourceCacheService(extensionContext));
	appContext.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, new AzureResourceSubscriptionService());
	appContext.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, new AzureResourceSubscriptionFilterService(new AzureResourceCacheService(extensionContext)));
	appContext.registerService<IAzureResourceTenantService>(AzureResourceServiceNames.tenantService, new AzureResourceTenantService());
}

function registerCommands(appContext: AppContext, azureResourceTree: AzureResourceTreeProvider): void {
	registerAzureResourceCommands(appContext, azureResourceTree);

	registerAzureResourceDatabaseServerCommands(appContext);

	registerAzureResourceDatabaseCommands(appContext);
}

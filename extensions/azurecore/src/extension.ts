/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

import { AppContext } from './appContext';
import { AzureAccountProviderService } from './account-provider/azureAccountProviderService';

import { AzureResourceDatabaseServerProvider } from './azureResource/providers/databaseServer/databaseServerProvider';
import { AzureResourceDatabaseServerService } from './azureResource/providers/databaseServer/databaseServerService';
import { AzureResourceDatabaseProvider } from './azureResource/providers/database/databaseProvider';
import { AzureResourceDatabaseService } from './azureResource/providers/database/databaseService';
import { AzureResourceService } from './azureResource/resourceService';
import { IAzureResourceCacheService, IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService, IAzureTerminalService } from './azureResource/interfaces';
import { AzureResourceServiceNames } from './azureResource/constants';
import { AzureResourceSubscriptionService } from './azureResource/services/subscriptionService';
import { AzureResourceSubscriptionFilterService } from './azureResource/services/subscriptionFilterService';
import { AzureResourceCacheService } from './azureResource/services/cacheService';
import { registerAzureResourceCommands } from './azureResource/commands';
import { AzureResourceTreeProvider } from './azureResource/tree/treeProvider';
import { SqlInstanceResourceService } from './azureResource/providers/sqlinstance/sqlInstanceService';
import { SqlInstanceProvider } from './azureResource/providers/sqlinstance/sqlInstanceProvider';
import { PostgresServerProvider } from './azureResource/providers/postgresServer/postgresServerProvider';
import { PostgresServerService } from './azureResource/providers/postgresServer/postgresServerService';
import { AzureTerminalService } from './azureResource/services/terminalService';
import { SqlInstanceArcProvider } from './azureResource/providers/sqlinstanceArc/sqlInstanceArcProvider';
import { SqlInstanceArcResourceService } from './azureResource/providers/sqlinstanceArc/sqlInstanceArcService';
import { PostgresServerArcProvider } from './azureResource/providers/postgresArcServer/postgresServerProvider';
import { PostgresServerArcService } from './azureResource/providers/postgresArcServer/postgresServerService';
import { azureResource } from './azureResource/azure-resource';
import * as azurecore from './azurecore';
import * as azureResourceUtils from './azureResource/utils';
import * as utils from './utils';
import * as loc from './localizedConstants';
import * as constants from './constants';
import { AzureResourceGroupService } from './azureResource/providers/resourceGroup/resourceGroupService';
import { Logger } from './utils/Logger';

let extensionContext: vscode.ExtensionContext;

// The function is a duplicate of \src\paths.js. IT would be better to import path.js but it doesn't
// work for now because the extension is running in different process.
function getAppDataPath() {
	let platform = process.platform;
	switch (platform) {
		case 'win32': return process.env['APPDATA'] || path.join(process.env['USERPROFILE'], 'AppData', 'Roaming');
		case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support');
		case 'linux': return process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
		default: throw new Error('Platform not supported');
	}
}

function getDefaultLogLocation() {
	return path.join(getAppDataPath(), 'azuredatastudio');
}

function pushDisposable(disposable: vscode.Disposable): void {
	extensionContext.subscriptions.push(disposable);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext): Promise<azurecore.IExtension> {
	extensionContext = context;
	let appContext = new AppContext(extensionContext);

	let storagePath = await findOrMakeStoragePath();
	if (!storagePath) {
		return undefined;
	}
	updatePiiLoggingLevel();

	// Create the provider service and activate
	initAzureAccountProvider(extensionContext, storagePath).catch((err) => console.log(err));

	registerAzureServices(appContext);
	const azureResourceTree = new AzureResourceTreeProvider(appContext);
	pushDisposable(vscode.window.registerTreeDataProvider('azureResourceExplorer', azureResourceTree));
	pushDisposable(vscode.workspace.onDidChangeConfiguration(e => onDidChangeConfiguration(e), this));
	registerAzureResourceCommands(appContext, azureResourceTree);

	return {
		getSubscriptions(account?: azdata.Account, ignoreErrors?: boolean): Thenable<azurecore.GetSubscriptionsResult> { return azureResourceUtils.getSubscriptions(appContext, account, ignoreErrors); },
		getResourceGroups(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription, ignoreErrors?: boolean): Thenable<azurecore.GetResourceGroupsResult> { return azureResourceUtils.getResourceGroups(appContext, account, subscription, ignoreErrors); },
		provideResources(): azureResource.IAzureResourceProvider[] {
			const arcFeaturedEnabled = vscode.workspace.getConfiguration(constants.extensionConfigSectionName).get('enableArcFeatures');
			const providers: azureResource.IAzureResourceProvider[] = [
				new AzureResourceDatabaseServerProvider(new AzureResourceDatabaseServerService(), extensionContext),
				new AzureResourceDatabaseProvider(new AzureResourceDatabaseService(), extensionContext),
				new SqlInstanceProvider(new SqlInstanceResourceService(), extensionContext),
				new PostgresServerProvider(new PostgresServerService(), extensionContext),
			];
			if (arcFeaturedEnabled) {
				providers.push(
					new SqlInstanceArcProvider(new SqlInstanceArcResourceService(), extensionContext),
					new PostgresServerArcProvider(new PostgresServerArcService(), extensionContext)
				);
			}
			return providers;
		},
		getRegionDisplayName: utils.getRegionDisplayName
	};
}

// Create the folder for storing the token caches
async function findOrMakeStoragePath() {
	let defaultLogLocation = getDefaultLogLocation();
	let storagePath = path.join(defaultLogLocation, loc.extensionName);

	try {
		await fs.mkdir(defaultLogLocation, { recursive: true });
	} catch (e) {
		if (e.code !== 'EEXIST') {
			console.log(`Creating the base directory failed... ${e}`);
			return undefined;
		}
	}

	try {
		await fs.mkdir(storagePath, { recursive: true });
	} catch (e) {
		if (e.code !== 'EEXIST') {
			console.error(`Initialization of Azure account extension storage failed: ${e}`);
			console.error('Azure accounts will not be available');
			return undefined;
		}
	}

	console.log('Initialized Azure account extension storage.');
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
	appContext.registerService<AzureResourceGroupService>(AzureResourceServiceNames.resourceGroupService, new AzureResourceGroupService());
	appContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, new AzureResourceCacheService(extensionContext));
	appContext.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, new AzureResourceSubscriptionService());
	appContext.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, new AzureResourceSubscriptionFilterService(new AzureResourceCacheService(extensionContext)));
	appContext.registerService<IAzureTerminalService>(AzureResourceServiceNames.terminalService, new AzureTerminalService(extensionContext));
}

async function onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent): Promise<void> {
	if (e.affectsConfiguration('azure.enableArcFeatures')) {
		const response = await vscode.window.showInformationMessage(loc.requiresReload, loc.reload);
		if (response === loc.reload) {
			await vscode.commands.executeCommand('workbench.action.reloadWindow');
		}
		return;
	}

	if (e.affectsConfiguration('azure.piiLogging')) {
		updatePiiLoggingLevel();
	}
}

function updatePiiLoggingLevel() {
	const piiLogging: boolean = vscode.workspace.getConfiguration(constants.extensionConfigSectionName).get('piiLogging');
	Logger.piiLogging = piiLogging;
}

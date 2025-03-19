/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

import { AppContext } from './appContext';
import { AzureAccountProviderService } from './account-provider/azureAccountProviderService';
import { AzureResourceService } from './azureResource/resourceService';
import { IAzureResourceCacheService, IAzureResourceSubscriptionService, IAzureResourceSubscriptionFilterService, IAzureTerminalService, IAzureResourceTenantFilterService } from './azureResource/interfaces';
import { AzureResourceServiceNames } from './azureResource/constants';
import { AzureResourceSubscriptionService } from './azureResource/services/subscriptionService';
import { AzureResourceSubscriptionFilterService } from './azureResource/services/subscriptionFilterService';
import { AzureResourceCacheService } from './azureResource/services/cacheService';
import { registerAzureResourceCommands } from './azureResource/commands';
import { AzureResourceTreeProvider } from './azureResource/tree/treeProvider';
import { AzureTerminalService } from './azureResource/services/terminalService';
import * as azurecore from 'azurecore';
import * as azureResourceUtils from './azureResource/utils';
import * as utils from './utils';
import * as loc from './localizedConstants';
import * as Constants from './constants';
import { AzureResourceGroupService } from './azureResource/providers/resourceGroup/resourceGroupService';
import { Logger } from './utils/Logger';
import { ConnectionDialogTreeProvider } from './azureResource/tree/connectionDialogTreeProvider';
import { AzureDataGridProvider } from './azureDataGridProvider';
import { AzureResourceUniversalService } from './azureResource/providers/universal/universalService';
import { AzureResourceUniversalTreeDataProvider } from './azureResource/providers/universal/universalTreeDataProvider';
import { AzureResourceUniversalResourceProvider } from './azureResource/providers/universal/universalProvider';
import { AzureResourceTenantFilterService } from './azureResource/services/tenantFilterService';

let extensionContext: vscode.ExtensionContext;

// The function is a duplicate of \src\paths.js. IT would be better to import path.js but it doesn't
// work for now because the extension is running in different process.
function getAppDataPath() {
	let platform = process.platform;
	switch (platform) {
		case Constants.Platform.Windows: return process.env['APPDATA'] || path.join(process.env['USERPROFILE']!, 'AppData', 'Roaming');
		case Constants.Platform.Mac: return path.join(os.homedir(), 'Library', 'Application Support');
		case Constants.Platform.Linux: return process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
		default: throw new Error('Platform not supported');
	}
}

function getDefaultLogLocation() {
	return path.join(getAppDataPath(), Constants.ServiceName);
}

function pushDisposable(disposable: vscode.Disposable): void {
	extensionContext.subscriptions.push(disposable);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext): Promise<azurecore.IExtension> {
	Logger.verbose("In activate");
	extensionContext = context;
	let appContext = new AppContext(extensionContext);

	let storagePath = await findOrMakeStoragePath();
	if (!storagePath) {
		Logger.error("Could not find or create storage path");
		throw new Error('Could not find or create storage path');
	}

	// TODO: Since Code Grant auth doesnt work in web mode, enabling Device code auth by default for web mode. We can remove this once we have that working in web mode.
	const config = vscode.workspace.getConfiguration(Constants.AccountsAzureAuthSection);
	if (vscode.env.uiKind === vscode.UIKind.Web) {
		await config.update('deviceCode', true, vscode.ConfigurationTarget.Global);
	}

	const piiLogging = vscode.workspace.getConfiguration(Constants.AzureSection).get(Constants.piiLogging, false)
	if (piiLogging) {
		void vscode.window.showWarningMessage(loc.piiWarning, loc.disable, loc.dismiss).then(async (value) => {
			if (value === loc.disable) {
				await vscode.workspace.getConfiguration(Constants.AzureSection).update(Constants.piiLogging, false, vscode.ConfigurationTarget.Global);
			}
		});

	}
	updatePiiLoggingLevel();

	let eventEmitter: vscode.EventEmitter<azurecore.CacheEncryptionKeys>;
	// Create the provider service and activate
	let providerService = await initAzureAccountProvider(extensionContext, storagePath).catch((err) => Logger.error(err));
	if (providerService) {
		eventEmitter = providerService.getEncryptionKeysEmitter();

		registerAzureServices(appContext);
		const azureResourceTree = new AzureResourceTreeProvider(appContext);
		const connectionDialogTree = new ConnectionDialogTreeProvider(appContext);
		Logger.verbose("Registering azure resource explorer");
		pushDisposable(vscode.window.registerTreeDataProvider('azureResourceExplorer', azureResourceTree));

		Logger.verbose("Registering connectionDialog/azureResourceExplorer");
		pushDisposable(vscode.window.registerTreeDataProvider('connectionDialog/azureResourceExplorer', connectionDialogTree));

		pushDisposable(vscode.workspace.onDidChangeConfiguration(e => onDidChangeConfiguration(e)));
		registerAzureResourceCommands(appContext, azureResourceTree, connectionDialogTree);
		azdata.dataprotocol.registerDataGridProvider(new AzureDataGridProvider(appContext));
		vscode.commands.registerCommand('azure.dataGrid.openInAzurePortal', async (item: azdata.DataGridItem) => {
			const portalEndpoint = item.portalEndpoint;
			const subscriptionId = item.subscriptionId;
			const resourceGroup = item.resourceGroup;
			const type = item.type;
			const name = item.name;
			if (portalEndpoint && subscriptionId && resourceGroup && type && name) {
				Logger.verbose("Opening the following url externally: " + `${portalEndpoint}/#resource/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/${type}/${name}`);
				await vscode.env.openExternal(vscode.Uri.parse(`${portalEndpoint}/#resource/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/${type}/${name}`));
			} else {
				Logger.error(`Missing required values - subscriptionId : ${subscriptionId} resourceGroup : ${resourceGroup} type: ${type} name: ${name}`);
				void vscode.window.showErrorMessage(loc.unableToOpenAzureLink);
			}
		});
	}
	return {
		getSubscriptions(account?: azurecore.AzureAccount, ignoreErrors?: boolean, selectedOnly: boolean = false): Promise<azurecore.GetSubscriptionsResult> {
			return selectedOnly
				? azureResourceUtils.getSelectedSubscriptions(appContext, account, ignoreErrors)
				: azureResourceUtils.getSubscriptions(appContext, account, ignoreErrors);
		},
		getResourceGroups(account?: azurecore.AzureAccount, subscription?: azurecore.azureResource.AzureResourceSubscription, ignoreErrors?: boolean): Promise<azurecore.GetResourceGroupsResult> {
			return azureResourceUtils.getResourceGroups(appContext, account, subscription, ignoreErrors);
		},
		getLocations(account?: azurecore.AzureAccount,
			subscription?: azurecore.azureResource.AzureResourceSubscription,
			ignoreErrors?: boolean): Promise<azurecore.GetLocationsResult> {
			return azureResourceUtils.getLocations(appContext, account, subscription, ignoreErrors);
		},
		provideResources(): azurecore.azureResource.IAzureResourceProvider[] {
			return azureResourceUtils.getAllResourceProviders(extensionContext);
		},
		getUniversalProvider(): azurecore.azureResource.IAzureUniversalResourceProvider {
			let providers = azureResourceUtils.getAllResourceProviders(extensionContext);
			let treeDataProviders = new Map<string, azurecore.azureResource.IAzureResourceTreeDataProvider>();
			providers.forEach(provider => {
				treeDataProviders.set(provider.providerId, provider.getTreeDataProvider());
			})
			return new AzureResourceUniversalResourceProvider(Constants.UNIVERSAL_PROVIDER_ID, new AzureResourceUniversalTreeDataProvider(new AzureResourceUniversalService(treeDataProviders)));
		},
		getSqlManagedInstances(account: azurecore.AzureAccount,
			subscriptions: azurecore.azureResource.AzureResourceSubscription[],
			ignoreErrors: boolean): Promise<azurecore.GetSqlManagedInstancesResult> {
			return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, `where type == "${azurecore.azureResource.AzureResourceType.sqlManagedInstance}"`);
		},
		getManagedDatabases(account: azurecore.AzureAccount,
			subscription: azurecore.azureResource.AzureResourceSubscription,
			managedInstance: azurecore.azureResource.AzureSqlManagedInstance,
			ignoreErrors: boolean): Promise<azurecore.GetManagedDatabasesResult> {
			return azureResourceUtils.getManagedDatabases(account, subscription, managedInstance, ignoreErrors);
		},
		getSqlServers(account: azurecore.AzureAccount,
			subscriptions: azurecore.azureResource.AzureResourceSubscription[],
			ignoreErrors: boolean): Promise<azurecore.GetSqlServersResult> {
			return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, `where type == "${azurecore.azureResource.AzureResourceType.sqlServer}"`);
		},
		getSqlVMServers(account: azurecore.AzureAccount,
			subscriptions: azurecore.azureResource.AzureResourceSubscription[],
			ignoreErrors: boolean): Promise<azurecore.GetSqlVMServersResult> {
			return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, `where type == "${azurecore.azureResource.AzureResourceType.virtualMachines}" and properties.storageProfile.imageReference.publisher == "microsoftsqlserver"`);
		},
		getStorageAccounts(account: azurecore.AzureAccount,
			subscriptions: azurecore.azureResource.AzureResourceSubscription[],
			ignoreErrors: boolean): Promise<azurecore.GetStorageAccountResult> {
			return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, `where type == "${azurecore.azureResource.AzureResourceType.storageAccount}"`);
		},
		getBlobContainers(account: azurecore.AzureAccount,
			subscription: azurecore.azureResource.AzureResourceSubscription,
			storageAccount: azurecore.azureResource.AzureGraphResource,
			ignoreErrors: boolean): Promise<azurecore.GetBlobContainersResult> {
			return azureResourceUtils.getBlobContainers(account, subscription, storageAccount, ignoreErrors);
		},
		getFileShares(account: azurecore.AzureAccount,
			subscription: azurecore.azureResource.AzureResourceSubscription,
			storageAccount: azurecore.azureResource.AzureGraphResource,
			ignoreErrors: boolean): Promise<azurecore.GetFileSharesResult> {
			return azureResourceUtils.getFileShares(account, subscription, storageAccount, ignoreErrors);
		},
		getStorageAccountAccessKey(account: azurecore.AzureAccount,
			subscription: azurecore.azureResource.AzureResourceSubscription,
			storageAccount: azurecore.azureResource.AzureGraphResource,
			ignoreErrors: boolean): Promise<azurecore.GetStorageAccountAccessKeyResult> {
			return azureResourceUtils.getStorageAccountAccessKey(account, subscription, storageAccount, ignoreErrors);
		},
		getBlobs(account: azurecore.AzureAccount,
			subscription: azurecore.azureResource.AzureResourceSubscription,
			storageAccount: azurecore.azureResource.AzureGraphResource,
			containerName: string,
			ignoreErrors: boolean): Promise<azurecore.GetBlobsResult> {
			return azureResourceUtils.getBlobs(account, subscription, storageAccount, containerName, ignoreErrors);
		},
		createResourceGroup(account: azurecore.AzureAccount,
			subscription: azurecore.azureResource.AzureResourceSubscription,
			resourceGroupName: string,
			location: string,
			ignoreErrors: boolean): Promise<azurecore.CreateResourceGroupResult> {
			return azureResourceUtils.createResourceGroup(account, subscription, resourceGroupName, location, ignoreErrors);
		},
		makeAzureRestRequest<B>(account: azurecore.AzureAccount,
			subscription: azurecore.azureResource.AzureResourceSubscription,
			path: string,
			requestType: azurecore.HttpRequestMethod,
			requestBody: any,
			ignoreErrors: boolean,
			host: string = 'https://management.azure.com',
			requestHeaders: Record<string, string> = {}): Promise<azurecore.AzureRestResponse<B>> {
			return azureResourceUtils.makeHttpRequest(account, subscription, path, requestType, requestBody, ignoreErrors, host, requestHeaders);
		},
		getRegionDisplayName: utils.getRegionDisplayName,
		getProviderMetadataForAccount(account: azurecore.AzureAccount) {
			return azureResourceUtils.getProviderMetadataForAccount(account);
		},
		runGraphQuery<T extends azurecore.azureResource.AzureGraphResource>(account: azurecore.AzureAccount,
			subscriptions: azurecore.azureResource.AzureResourceSubscription[],
			ignoreErrors: boolean,
			query: string): Promise<azurecore.ResourceQueryResult<T>> {
			return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, query);
		},
		onEncryptionKeysUpdated: eventEmitter!.event,
		async getEncryptionKeys(): Promise<azurecore.CacheEncryptionKeys> {
			if (!providerService) {
				throw new Error("Failed to initialize Azure account provider.");
			}
			return await providerService!.getEncryptionKeys();
		}
	};
}

// Create the folder for storing the token caches
async function findOrMakeStoragePath() {
	Logger.verbose("In findOrMakeStoragePath");
	let defaultLogLocation = getDefaultLogLocation();
	let storagePath = path.join(defaultLogLocation, Constants.AzureTokenFolderName);

	try {
		await fs.mkdir(defaultLogLocation, { recursive: true });
	} catch (e) {
		if (e.code !== 'EEXIST') {
			Logger.error(`Creating the base directory failed... ${e}`);
			return undefined;
		}
	}

	try {
		await fs.mkdir(storagePath, { recursive: true });
	} catch (e) {
		if (e.code !== 'EEXIST') {
			Logger.error(`Initialization of Azure account extension storage failed: ${e}`);
			Logger.error('Azure accounts will not be available');
			return undefined;
		}
	}

	Logger.verbose('Initialized Azure account extension storage.');
	return storagePath;
}

async function initAzureAccountProvider(extensionContext: vscode.ExtensionContext, storagePath: string): Promise<AzureAccountProviderService | undefined> {
	Logger.verbose("In initAzureAccountProvider");
	try {
		const accountProviderService = new AzureAccountProviderService(extensionContext, storagePath);
		extensionContext.subscriptions.push(accountProviderService);
		await accountProviderService.activate();
		Logger.verbose("Completed initializing azure account provider");
		return accountProviderService;
	} catch (err) {
		Logger.error('Unexpected error starting account provider: ' + err.message);
		return undefined;
	}
}

function registerAzureServices(appContext: AppContext): void {
	appContext.registerService<AzureResourceService>(AzureResourceServiceNames.resourceService, new AzureResourceService());
	appContext.registerService<AzureResourceGroupService>(AzureResourceServiceNames.resourceGroupService, new AzureResourceGroupService());
	appContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, new AzureResourceCacheService(extensionContext));
	appContext.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, new AzureResourceSubscriptionService());
	appContext.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, new AzureResourceSubscriptionFilterService(new AzureResourceCacheService(extensionContext)));
	appContext.registerService<IAzureResourceTenantFilterService>(AzureResourceServiceNames.tenantFilterService, new AzureResourceTenantFilterService(new AzureResourceCacheService(extensionContext)));
	appContext.registerService<IAzureTerminalService>(AzureResourceServiceNames.terminalService, new AzureTerminalService(extensionContext));
}

async function onDidChangeConfiguration(e: vscode.ConfigurationChangeEvent): Promise<void> {
	if (e.affectsConfiguration('azure.piiLogging')) {
		updatePiiLoggingLevel();
	}
}

function updatePiiLoggingLevel(): void {
	const piiLogging: boolean = vscode.workspace.getConfiguration(Constants.AzureSection).get('piiLogging', false);
	Logger.piiLogging = piiLogging;
}

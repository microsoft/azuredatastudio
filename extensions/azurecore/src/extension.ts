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
import { KustoResourceService } from './azureResource/providers/kusto/kustoService';
import { KustoProvider } from './azureResource/providers/kusto/kustoProvider';
import { AzureMonitorResourceService } from './azureResource/providers/azuremonitor/azuremonitorService';
import { AzureMonitorProvider } from './azureResource/providers/azuremonitor/azuremonitorProvider';
import { PostgresServerProvider } from './azureResource/providers/postgresServer/postgresServerProvider';
import { PostgresServerService } from './azureResource/providers/postgresServer/postgresServerService';
import { AzureTerminalService } from './azureResource/services/terminalService';
import { SqlInstanceArcProvider } from './azureResource/providers/sqlinstanceArc/sqlInstanceArcProvider';
import { SqlInstanceArcResourceService } from './azureResource/providers/sqlinstanceArc/sqlInstanceArcService';
import { PostgresServerArcProvider } from './azureResource/providers/postgresArcServer/postgresServerProvider';
import { PostgresServerArcService } from './azureResource/providers/postgresArcServer/postgresServerService';
import { azureResource } from 'azureResource';
import * as azurecore from 'azurecore';
import * as azureResourceUtils from './azureResource/utils';
import * as utils from './utils';
import * as loc from './localizedConstants';
import * as constants from './constants';
import { AzureResourceGroupService } from './azureResource/providers/resourceGroup/resourceGroupService';
import { Logger } from './utils/Logger';
import { ConnectionDialogTreeProvider } from './azureResource/tree/connectionDialogTreeProvider';
import { AzureDataGridProvider } from './azureDataGridProvider';

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

	// TODO: Since Code Grant auth doesnt work in web mode, enabling Device code auth by default for web mode. We can remove this once we have that working in web mode.
	const config = vscode.workspace.getConfiguration('accounts.azure.auth');
	if (vscode.env.uiKind === vscode.UIKind.Web) {
		await config.update('deviceCode', true, vscode.ConfigurationTarget.Global);
	}

	updatePiiLoggingLevel();

	// Create the provider service and activate
	initAzureAccountProvider(extensionContext, storagePath).catch((err) => console.log(err));

	registerAzureServices(appContext);
	const azureResourceTree = new AzureResourceTreeProvider(appContext);
	const connectionDialogTree = new ConnectionDialogTreeProvider(appContext);
	pushDisposable(vscode.window.registerTreeDataProvider('azureResourceExplorer', azureResourceTree));
	pushDisposable(vscode.window.registerTreeDataProvider('connectionDialog/azureResourceExplorer', connectionDialogTree));
	pushDisposable(vscode.workspace.onDidChangeConfiguration(e => onDidChangeConfiguration(e), this));
	registerAzureResourceCommands(appContext, azureResourceTree, connectionDialogTree);
	azdata.dataprotocol.registerDataGridProvider(new AzureDataGridProvider(appContext));
	vscode.commands.registerCommand('azure.dataGrid.openInAzurePortal', async (item: azdata.DataGridItem) => {
		const portalEndpoint = item.portalEndpoint;
		const subscriptionId = item.subscriptionId;
		const resourceGroup = item.resourceGroup;
		const type = item.type;
		const name = item.name;
		if (portalEndpoint && subscriptionId && resourceGroup && type && name) {
			await vscode.env.openExternal(vscode.Uri.parse(`${portalEndpoint}/#resource/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/${type}/${name}`));
		} else {
			console.log(`Missing required values - subscriptionId : ${subscriptionId} resourceGroup : ${resourceGroup} type: ${type} name: ${name}`);
			void vscode.window.showErrorMessage(loc.unableToOpenAzureLink);
		}
	});

	return {
		getSubscriptions(account?: azurecore.AzureAccount, ignoreErrors?: boolean, selectedOnly: boolean = false): Promise<azurecore.GetSubscriptionsResult> {
			return selectedOnly
				? azureResourceUtils.getSelectedSubscriptions(appContext, account, ignoreErrors)
				: azureResourceUtils.getSubscriptions(appContext, account, ignoreErrors);
		},
		getResourceGroups(account?: azurecore.AzureAccount, subscription?: azureResource.AzureResourceSubscription, ignoreErrors?: boolean): Promise<azurecore.GetResourceGroupsResult> { return azureResourceUtils.getResourceGroups(appContext, account, subscription, ignoreErrors); },
		getLocations(account?: azurecore.AzureAccount,
			subscription?: azureResource.AzureResourceSubscription,
			ignoreErrors?: boolean): Promise<azurecore.GetLocationsResult> {
			return azureResourceUtils.getLocations(appContext, account, subscription, ignoreErrors);
		},
		provideResources(): azureResource.IAzureResourceProvider[] {
			const arcFeaturedEnabled = vscode.workspace.getConfiguration(constants.extensionConfigSectionName).get('enableArcFeatures');
			const providers: azureResource.IAzureResourceProvider[] = [
				new KustoProvider(new KustoResourceService(), extensionContext),
				new AzureMonitorProvider(new AzureMonitorResourceService(), extensionContext),
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
		getSqlManagedInstances(account: azurecore.AzureAccount,
			subscriptions: azureResource.AzureResourceSubscription[],
			ignoreErrors: boolean): Promise<azurecore.GetSqlManagedInstancesResult> {
			return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, `where type == "${azureResource.AzureResourceType.sqlManagedInstance}"`);
		},
		getManagedDatabases(account: azurecore.AzureAccount,
			subscription: azureResource.AzureResourceSubscription,
			managedInstance: azureResource.AzureSqlManagedInstance,
			ignoreErrors: boolean): Promise<azurecore.GetManagedDatabasesResult> {
			return azureResourceUtils.getManagedDatabases(account, subscription, managedInstance, ignoreErrors);
		},
		getSqlServers(account: azurecore.AzureAccount,
			subscriptions: azureResource.AzureResourceSubscription[],
			ignoreErrors: boolean): Promise<azurecore.GetSqlServersResult> {
			return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, `where type == "${azureResource.AzureResourceType.sqlServer}"`);
		},
		getSqlVMServers(account: azurecore.AzureAccount,
			subscriptions: azureResource.AzureResourceSubscription[],
			ignoreErrors: boolean): Promise<azurecore.GetSqlVMServersResult> {
			return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, `where type == "${azureResource.AzureResourceType.virtualMachines}" and properties.storageProfile.imageReference.publisher == "microsoftsqlserver"`);
		},
		getStorageAccounts(account: azurecore.AzureAccount,
			subscriptions: azureResource.AzureResourceSubscription[],
			ignoreErrors: boolean): Promise<azurecore.GetStorageAccountResult> {
			return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, `where type == "${azureResource.AzureResourceType.storageAccount}"`);
		},
		getBlobContainers(account: azurecore.AzureAccount,
			subscription: azureResource.AzureResourceSubscription,
			storageAccount: azureResource.AzureGraphResource,
			ignoreErrors: boolean): Promise<azurecore.GetBlobContainersResult> {
			return azureResourceUtils.getBlobContainers(account, subscription, storageAccount, ignoreErrors);
		},
		getFileShares(account: azurecore.AzureAccount,
			subscription: azureResource.AzureResourceSubscription,
			storageAccount: azureResource.AzureGraphResource,
			ignoreErrors: boolean): Promise<azurecore.GetFileSharesResult> {
			return azureResourceUtils.getFileShares(account, subscription, storageAccount, ignoreErrors);
		},
		getStorageAccountAccessKey(account: azurecore.AzureAccount,
			subscription: azureResource.AzureResourceSubscription,
			storageAccount: azureResource.AzureGraphResource,
			ignoreErrors: boolean): Promise<azurecore.GetStorageAccountAccessKeyResult> {
			return azureResourceUtils.getStorageAccountAccessKey(account, subscription, storageAccount, ignoreErrors);
		},
		getBlobs(account: azurecore.AzureAccount,
			subscription: azureResource.AzureResourceSubscription,
			storageAccount: azureResource.AzureGraphResource,
			containerName: string,
			ignoreErrors: boolean): Promise<azurecore.GetBlobsResult> {
			return azureResourceUtils.getBlobs(account, subscription, storageAccount, containerName, ignoreErrors);
		},
		createResourceGroup(account: azurecore.AzureAccount,
			subscription: azureResource.AzureResourceSubscription,
			resourceGroupName: string,
			location: string,
			ignoreErrors: boolean): Promise<azurecore.CreateResourceGroupResult> {
			return azureResourceUtils.createResourceGroup(account, subscription, resourceGroupName, location, ignoreErrors);
		},
		makeAzureRestRequest(account: azurecore.AzureAccount,
			subscription: azureResource.AzureResourceSubscription,
			path: string,
			requestType: azurecore.HttpRequestMethod,
			requestBody: any,
			ignoreErrors: boolean,
			host: string = 'https://management.azure.com',
			requestHeaders: { [key: string]: string } = {}): Promise<azurecore.AzureRestResponse> {
			return azureResourceUtils.makeHttpRequest(account, subscription, path, requestType, requestBody, ignoreErrors, host, requestHeaders);
		},
		getRegionDisplayName: utils.getRegionDisplayName,
		runGraphQuery<T extends azureResource.AzureGraphResource>(account: azurecore.AzureAccount,
			subscriptions: azureResource.AzureResourceSubscription[],
			ignoreErrors: boolean,
			query: string): Promise<azurecore.ResourceQueryResult<T>> {
			return azureResourceUtils.runResourceQuery(account, subscriptions, ignoreErrors, query);
		}
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
	if (e.affectsConfiguration('azure.piiLogging')) {
		updatePiiLoggingLevel();
	}
}

function updatePiiLoggingLevel() {
	const piiLogging: boolean = vscode.workspace.getConfiguration(constants.extensionConfigSectionName).get('piiLogging');
	Logger.piiLogging = piiLogging;
}

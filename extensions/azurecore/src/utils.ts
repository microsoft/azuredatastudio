/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as loc from './localizedConstants';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as constants from './constants';

import { AzureRegion, azureResource } from 'azurecore';
import { AppContext } from './appContext';
import { HttpClient } from './account-provider/auths/httpClient';
import { parse } from 'url';
import { getProxyAgentOptions } from './proxy';
import { HttpsProxyAgentOptions } from 'https-proxy-agent';
import { ProviderSettings, ProviderSettingsJson, SettingIds } from './account-provider/interfaces';
import { AzureResource } from 'azdata';

const localize = nls.loadMessageBundle();
const configProxy = 'proxy';
const configProxyStrictSSL = 'proxyStrictSSL';
const configProxyAuthorization = 'proxyAuthorization';

/**
 * Converts a region value (@see AzureRegion) into the localized Display Name
 * @param region The region value
 */
export function getRegionDisplayName(region?: string): string {
	region = (region ?? '');

	switch (region.toLocaleLowerCase()) {
		case AzureRegion.australiacentral:
			return loc.australiaCentral;
		case AzureRegion.australiacentral2:
			return loc.australiaCentral2;
		case AzureRegion.australiaeast:
			return loc.australiaEast;
		case AzureRegion.australiasoutheast:
			return loc.australiaSouthEast;
		case AzureRegion.brazilsouth:
			return loc.brazilSouth;
		case AzureRegion.brazilsoutheast:
			return loc.brazilSouthEast;
		case AzureRegion.canadacentral:
			return loc.canadaCentral;
		case AzureRegion.canadaeast:
			return loc.canadaEast;
		case AzureRegion.centralindia:
			return loc.centralIndia;
		case AzureRegion.centralus:
			return loc.centralUS;
		case AzureRegion.centraluseuap:
			return loc.centralUSEUAP;
		case AzureRegion.eastasia:
			return loc.eastAsia;
		case AzureRegion.eastus:
			return loc.eastUS;
		case AzureRegion.eastus2:
			return loc.eastUS2;
		case AzureRegion.eastus2euap:
			return loc.eastUS2EUAP;
		case AzureRegion.francecentral:
			return loc.franceCentral;
		case AzureRegion.francesouth:
			return loc.franceSouth;
		case AzureRegion.germanynorth:
			return loc.germanyNorth;
		case AzureRegion.germanywestcentral:
			return loc.germanyWestCentral;
		case AzureRegion.japaneast:
			return loc.japanEast;
		case AzureRegion.japanwest:
			return loc.japanWest;
		case AzureRegion.koreacentral:
			return loc.koreaCentral;
		case AzureRegion.koreasouth:
			return loc.koreaSouth;
		case AzureRegion.northcentralus:
			return loc.northCentralUS;
		case AzureRegion.northeurope:
			return loc.northEurope;
		case AzureRegion.norwayeast:
			return loc.norwayEast;
		case AzureRegion.norwaywest:
			return loc.norwayWest;
		case AzureRegion.southafricanorth:
			return loc.southAfricaNorth;
		case AzureRegion.southafricawest:
			return loc.southAfricaWest;
		case AzureRegion.southcentralus:
			return loc.southCentralUS;
		case AzureRegion.southeastasia:
			return loc.southEastAsia;
		case AzureRegion.southindia:
			return loc.southIndia;
		case AzureRegion.switzerlandnorth:
			return loc.switzerlandNorth;
		case AzureRegion.switzerlandwest:
			return loc.switzerlandWest;
		case AzureRegion.uaecentral:
			return loc.uaeCentral;
		case AzureRegion.uaenorth:
			return loc.uaeNorth;
		case AzureRegion.uksouth:
			return loc.ukSouth;
		case AzureRegion.ukwest:
			return loc.ukWest;
		case AzureRegion.westcentralus:
			return loc.westCentralUS;
		case AzureRegion.westeurope:
			return loc.westEurope;
		case AzureRegion.westindia:
			return loc.westIndia;
		case AzureRegion.westus:
			return loc.westUS;
		case AzureRegion.westus2:
			return loc.westUS2;
	}
	console.warn(`Unknown Azure region ${region}`);
	return region;
}

export function getResourceTypeDisplayName(type: string): string {
	switch (type) {
		case azureResource.AzureResourceType.sqlServer:
			return loc.sqlServer;
		case azureResource.AzureResourceType.sqlDatabase:
			return loc.sqlDatabase;
		case azureResource.AzureResourceType.sqlManagedInstance:
			return loc.sqlManagedInstance;
		case azureResource.AzureResourceType.postgresServer:
			return loc.postgresServer;
		case azureResource.AzureResourceType.postgresFlexibleServer:
			return loc.postgresFlexibleServer;
		case azureResource.AzureResourceType.azureArcSqlManagedInstance:
			return loc.azureArcsqlManagedInstance;
		case azureResource.AzureResourceType.azureArcService:
			return loc.azureArcService;
		case azureResource.AzureResourceType.azureArcPostgresServer:
			return loc.azureArcPostgresServer;
	}
	return type;
}

function getHttpConfiguration(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(constants.httpConfigSectionName);
}

/**
 * Gets tenants to be ignored.
 * @returns Tenants configured in ignore list
 */
export function getTenantIgnoreList(): string[] {
	const configuration = vscode.workspace.getConfiguration(constants.AzureTenantConfigSection);
	return configuration.get(constants.Filter) ?? [];
}

/**
 * Updates tenant ignore list in global settings.
 * @param tenantIgnoreList Tenants to be configured in ignore list
 */
export async function updateTenantIgnoreList(tenantIgnoreList: string[]): Promise<void> {
	const configuration = vscode.workspace.getConfiguration(constants.AzureTenantConfigSection);
	await configuration.update(constants.Filter, tenantIgnoreList, vscode.ConfigurationTarget.Global);
}

export function updateProviderSettings(defaultSettings: ProviderSettings[]): ProviderSettings[] {
	let providerSettingsJson: ProviderSettingsJson[] | undefined = vscode.workspace.getConfiguration(constants.AzureSection).get(constants.ProviderSettingsJson) as ProviderSettingsJson[];
	vscode.workspace.onDidChangeConfiguration(async (changeEvent) => {
		const impactProvider = changeEvent.affectsConfiguration(constants.ProviderSettingsJsonSection);
		if (impactProvider === true) {
			await displayReloadAds(constants.ProviderSettingsJsonSection);
		}
	});
	if (providerSettingsJson) {
		try {
			for (let cloudProvider of providerSettingsJson) {
				// build provider setting
				let newSettings = buildProviderSettings(cloudProvider);
				defaultSettings.push(newSettings)
			}
			void vscode.window.showInformationMessage(localize('providerSettings.success', 'Successfully loaded custom endpoints file'));

		} catch (error) {
			console.log(error);
			void vscode.window.showErrorMessage(localize('providerSettings.error', 'could not load custom endpoints file'));
			throw Error(error.message);
		}
	}
	return defaultSettings;
}

function buildProviderSettings(cloudProvider: ProviderSettingsJson): ProviderSettings {
	// build provider setting
	let newSettings = {
		configKey: 'enable' + cloudProvider.settings.metadata.id,
		metadata: {
			displayName: cloudProvider.settings.metadata.displayName,
			id: cloudProvider.settings.metadata.id,
			settings: {
				host: cloudProvider.settings.metadata.endpoints.host,
				clientId: 'a69788c6-1d43-44ed-9ca3-b83e194da255',
				microsoftResource: {
					id: SettingIds.marm,
					endpoint: cloudProvider.settings.metadata.endpoints.microsoftResource,
					azureResourceId: AzureResource.MicrosoftResourceManagement
				},
				graphResource: {
					id: SettingIds.graph,
					endpoint: cloudProvider.settings.metadata.endpoints.graphResource,
					azureResourceId: AzureResource.Graph
				},
				msGraphResource: {
					id: SettingIds.msgraph,
					endpoint: cloudProvider.settings.metadata.endpoints.msGraphResource,
					azureResourceId: AzureResource.MsGraph
				},
				armResource: {
					id: SettingIds.arm,
					endpoint: cloudProvider.settings.metadata.endpoints.armResource,
					azureResourceId: AzureResource.ResourceManagement
				},
				sqlResource: {
					id: SettingIds.sql,
					endpoint: cloudProvider.settings.metadata.endpoints.sqlResource,
					azureResourceId: AzureResource.Sql
				},
				azureKeyVaultResource: {
					id: SettingIds.vault,
					endpoint: cloudProvider.settings.metadata.endpoints.azureKeyVaultResource,
					azureResourceId: AzureResource.AzureKeyVault
				},
				azureLogAnalyticsResource: {
					id: SettingIds.ala,
					endpoint: cloudProvider.settings.metadata.endpoints.azureLogAnalyticsResource,
					azureResourceId: AzureResource.AzureLogAnalytics,
				},
				azureStorageResource: {
					id: SettingIds.storage,
					endpoint: cloudProvider.settings.metadata.endpoints.azureStorageResource.endpoint,
					endpointSuffix: cloudProvider.settings.metadata.endpoints.azureStorageResource.endpointSuffix,
					azureResourceId: AzureResource.AzureStorage
				},
				azureKustoResource: {
					id: SettingIds.kusto,
					endpoint: cloudProvider.settings.metadata.endpoints.azureKustoResource,
					azureResourceId: AzureResource.AzureKusto,
				},
				powerBiResource: {
					id: SettingIds.powerbi,
					endpoint: cloudProvider.settings.metadata.endpoints.powerBiResource,
					azureResourceId: AzureResource.PowerBi
				},
				redirectUri: 'http://localhost',
				scopes: [
					'openid', 'email', 'profile', 'offline_access',
					cloudProvider.settings.metadata.endpoints.scopes
				],
				portalEndpoint: cloudProvider.settings.metadata.endpoints.portalEndpoint
			}
		}
	};
	return newSettings;
}

export function getResourceTypeIcon(appContext: AppContext, type: string): string {
	switch (type) {
		case azureResource.AzureResourceType.sqlServer:
			return appContext.extensionContext.asAbsolutePath('resources/sqlServer.svg');
		case azureResource.AzureResourceType.sqlDatabase:
			return appContext.extensionContext.asAbsolutePath('resources/sqlDatabase.svg');
		case azureResource.AzureResourceType.sqlManagedInstance:
			return appContext.extensionContext.asAbsolutePath('resources/sqlManagedInstance.svg');
		case azureResource.AzureResourceType.postgresServer:
			return appContext.extensionContext.asAbsolutePath('resources/postgresServer.svg');
		case azureResource.AzureResourceType.azureArcSqlManagedInstance:
			return appContext.extensionContext.asAbsolutePath('resources/azureArcSqlManagedInstance.svg');
		case azureResource.AzureResourceType.azureArcService:
			return appContext.extensionContext.asAbsolutePath('resources/azureArcService.svg');
		case azureResource.AzureResourceType.azureArcPostgresServer:
			return appContext.extensionContext.asAbsolutePath('resources/azureArcPostgresServer.svg');
	}
	return '';
}


export function getProxyEnabledHttpClient(): HttpClient {
	const proxy = <string>getHttpConfiguration().get(configProxy);
	const strictSSL = getHttpConfiguration().get(configProxyStrictSSL, true);
	const authorization = getHttpConfiguration().get(configProxyAuthorization);

	const url = parse(proxy);
	let agentOptions = getProxyAgentOptions(url, proxy, strictSSL);

	if (authorization && url.protocol === 'https:') {
		let httpsAgentOptions = agentOptions as HttpsProxyAgentOptions;
		httpsAgentOptions!.headers = Object.assign(httpsAgentOptions!.headers || {}, {
			'Proxy-Authorization': authorization
		});
		agentOptions = httpsAgentOptions;
	}

	return new HttpClient(proxy, agentOptions);
}

/**
 * Display notification with button to reload
 * @param sectionName Name of section to reload
 * @returns true if reload clicked, false otherwise.
 */
export async function displayReloadAds(sectionName: string): Promise<boolean> {
	const result = await vscode.window.showInformationMessage(loc.reloadPrompt(sectionName), loc.reloadChoice);
	if (result === loc.reloadChoice) {
		await vscode.commands.executeCommand('workbench.action.reloadWindow');
		return true;
	} else {
		return false;
	}
}

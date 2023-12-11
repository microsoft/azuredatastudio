/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as loc from './localizedConstants';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as constants from './constants';

import { AzureRegion, azureResource } from 'azurecore';
import { AppContext } from './appContext';
import { ProviderSettings, ProviderSettingsJson, SettingIds } from './account-provider/interfaces';
import { AzureResource } from 'azdata';
import { Logger } from './utils/Logger';
import { TelemetryAction, TelemetryReporter, TelemetryViews } from './telemetry';

const localize = nls.loadMessageBundle();

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

export function updateCustomCloudProviderSettings(defaultSettings: ProviderSettings[]): ProviderSettings[] {
	let providerSettingsJson: ProviderSettingsJson[] | undefined = vscode.workspace.getConfiguration(constants.AzureSection).get(constants.CustomProviderSettings) as ProviderSettingsJson[];
	vscode.workspace.onDidChangeConfiguration(async (changeEvent) => {
		const impactProvider = changeEvent.affectsConfiguration(constants.CustomProviderSettingsSection);
		if (impactProvider === true) {
			await displayReloadAds(constants.CustomProviderSettingsSection);
			TelemetryReporter.sendTelemetryEvent(TelemetryAction.ReloadAdsCustomEndpoints);
		}
	});
	if (providerSettingsJson && providerSettingsJson.length > 0) {
		try {
			for (let cloudProvider of providerSettingsJson) {
				// build provider setting
				let newSettings = buildCustomCloudProviderSettings(cloudProvider);
				defaultSettings.push(newSettings)
				Logger.info(`Custom provider settings loaded for ${cloudProvider.settings.metadata.displayName}`);
			}
			void vscode.window.showInformationMessage(localize('providerSettings.success', 'Successfully loaded custom endpoints from settings'));
			TelemetryReporter.sendTelemetryEvent(TelemetryAction.LoadCustomEndpointsSuccess);

		} catch (error) {
			void vscode.window.showErrorMessage(localize('providerSettings.error', 'Could not load endpoints from settings, please check the logs for more details.'));
			console.error(error.message);
			TelemetryReporter.sendErrorEvent2(TelemetryViews.AzureCore, TelemetryAction.LoadCustomEndpointsError, error);
			throw Error(error.message);
		}
	}
	return defaultSettings;
}

function buildCustomCloudProviderSettings(customProvider: ProviderSettingsJson): ProviderSettings {
	// build provider setting
	let newSettings: ProviderSettings = {
		configKey: 'enableCustom' + customProvider.settings.metadata.id,
		metadata: {
			displayName: customProvider.settings.metadata.displayName,
			id: customProvider.settings.metadata.id,
			settings: {
				host: customProvider.settings.metadata.endpoints.host,
				clientId: customProvider.settings.metadata.endpoints.clientId,
				microsoftResource: {
					id: SettingIds.marm,
					endpoint: customProvider.settings.metadata.endpoints.microsoftResource,
					azureResourceId: AzureResource.MicrosoftResourceManagement
				},
				armResource: {
					id: SettingIds.arm,
					endpoint: customProvider.settings.metadata.endpoints.armResource,
					azureResourceId: AzureResource.ResourceManagement
				},
				azureStorageResource: {
					id: SettingIds.storage,
					endpoint: customProvider.settings.metadata.endpoints.azureStorageResource.endpoint,
					endpointSuffix: customProvider.settings.metadata.endpoints.azureStorageResource.endpointSuffix,
					azureResourceId: AzureResource.AzureStorage
				},
				sqlResource: {
					id: SettingIds.sql,
					endpoint: customProvider.settings.metadata.endpoints.sqlResource,
					azureResourceId: AzureResource.Sql
				},
				redirectUri: 'http://localhost',
				scopes: [
					'openid', 'email', 'profile', 'offline_access',
					customProvider.settings.metadata.endpoints.scopes
				],
			}
		}
	};
	if (customProvider.settings.metadata.endpoints.msGraphResource) {
		newSettings.metadata.settings.msGraphResource = {
			id: SettingIds.msgraph,
			endpoint: customProvider.settings.metadata.endpoints.msGraphResource,
			azureResourceId: AzureResource.MsGraph
		};
	}
	if (customProvider.settings.metadata.endpoints.azureLogAnalyticsResource) {
		newSettings.metadata.settings.azureLogAnalyticsResource = {
			id: SettingIds.ala,
			endpoint: customProvider.settings.metadata.endpoints.azureLogAnalyticsResource,
			azureResourceId: AzureResource.AzureLogAnalytics
		};
	}
	if (customProvider.settings.metadata.endpoints.azureKustoResource) {
		newSettings.metadata.settings.azureKustoResource = {
			id: SettingIds.kusto,
			endpoint: customProvider.settings.metadata.endpoints.azureKustoResource,
			azureResourceId: AzureResource.AzureKusto
		};
	}
	if (customProvider.settings.metadata.endpoints.azureKeyVaultResource) {
		newSettings.metadata.settings.azureKeyVaultResource = {
			id: SettingIds.vault,
			endpoint: customProvider.settings.metadata.endpoints.azureKeyVaultResource,
			azureResourceId: AzureResource.AzureKeyVault
		};
	}
	if (customProvider.settings.metadata.endpoints.powerBiResource) {
		newSettings.metadata.settings.powerBiResource = {
			id: SettingIds.powerbi,
			endpoint: customProvider.settings.metadata.endpoints.powerBiResource,
			azureResourceId: AzureResource.PowerBi
		};
	}
	if (customProvider.settings.metadata.endpoints.portalEndpoint) {
		newSettings.metadata.settings.portalEndpoint = customProvider.settings.metadata.endpoints.portalEndpoint;
	}
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

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
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

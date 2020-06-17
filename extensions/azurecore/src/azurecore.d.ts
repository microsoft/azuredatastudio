/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { azureResource } from './azureResource/azure-resource';

/**
 * Covers defining what the azurecore extension exports to other extensions
 *
 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
 * (const enums get evaluated when typescript -> javascript so those are fine)
 */
export const enum extension {
	name = 'Microsoft.azurecore'
}

/**
 * Enumeration of the Azure datacenter regions. See https://docs.microsoft.com/dotnet/api/microsoft.azure.management.resourcemanager.fluent.core.region
 */
export const enum AzureRegion {
	australiacentral = 'australiacentral',
	australiacentral2 = 'australiacentral2',
	australiaeast = 'australiaeast',
	australiasoutheast = 'australiasoutheast',
	brazilsouth = 'brazilsouth',
	canadacentral = 'canadacentral',
	canadaeast = 'canadaeast',
	centralindia = 'centralindia',
	centralus = 'centralus',
	eastasia = 'eastasia',
	eastus = 'eastus',
	eastus2 = 'eastus2',
	francecentral = 'francecentral',
	francesouth = 'francesouth',
	germanynorth = 'germanynorth',
	germanywestcentral = 'germanywestcentral',
	japaneast = 'japaneast',
	japanwest = 'japanwest',
	koreacentral = 'koreacentral',
	koreasouth = 'koreasouth',
	northcentralus = 'northcentralus',
	northeurope = 'northeurope',
	norwayeast = 'norwayeast',
	norwaywest = 'norwaywest',
	southafricanorth = 'southafricanorth',
	southafricawest = 'southafricawest',
	southcentralus = 'southcentralus',
	southeastasia = 'southeastasia',
	southindia = 'southindia',
	switzerlandnorth = 'switzerlandnorth',
	switzerlandwest = 'switzerlandwest',
	uaecentral = 'uaecentral',
	uaenorth = 'uaenorth',
	uksouth = 'uksouth',
	ukwest = 'ukwest',
	westcentralus = 'westcentralus',
	westeurope = 'westeurope',
	westindia = 'westindia',
	westus = 'westus',
	westus2 = 'westus2',
}

export interface IExtension {
	getSubscriptions(account?: azdata.Account, ignoreErrors?: boolean): Thenable<GetSubscriptionsResult>;
	getResourceGroups(account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription, ignoreErrors?: boolean): Thenable<GetResourceGroupsResult>;
	/**
	 * Converts a region value (@see AzureRegion) into the localized Display Name
	 * @param region The region value
	 */
	getRegionDisplayName(region?: string): string;
	provideResources(): azureResource.IAzureResourceProvider[];
}

export type GetSubscriptionsResult = { subscriptions: azureResource.AzureResourceSubscription[], errors: Error[] };
export type GetResourceGroupsResult = { resourceGroups: azureResource.AzureResourceResourceGroup[], errors: Error[] };

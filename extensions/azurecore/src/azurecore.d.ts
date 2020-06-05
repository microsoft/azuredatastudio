/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
	asiaeast = 'asiaeast',
	asiasoutheast = 'asiasoutheast',
	australiacentral = 'australiacentral',
	australiacentral2 = 'australiacentral2',
	australiaeast = 'australiaeast',
	australiasoutheast = 'australiasoutheast',
	brazilsouth = 'brazilsouth',
	canadacentral = 'canadacentral',
	canadaeast = 'canadaeast',
	chinaeast = 'chinaeast',
	chinaeast2 = 'chinaeast2',
	chinanorth = 'chinanorth',
	chinanorth2 = 'chinanorth2',
	europenorth = 'europenorth',
	europewest = 'europewest',
	francecentral = 'francecentral',
	francesouth = 'francesouth',
	germanycentral = 'germanycentral',
	germanynorth = 'germanynorth',
	germanynortheast = 'germanynortheast',
	germanywestcentral = 'germanywestcentral',
	governmentusarizona = 'governmentusarizona',
	governmentusdodcentral = 'governmentusdodcentral',
	governmentusdodeast = 'governmentusdodeast',
	governmentusiowa = 'governmentusiowa',
	governmentustexas = 'governmentustexas',
	governmentusvirginia = 'governmentusvirginia',
	indiacentral = 'indiacentral',
	indiasouth = 'indiasouth',
	indiawest = 'indiawest',
	japaneast = 'japaneast',
	japanwest = 'japanwest',
	koreacentral = 'koreacentral',
	koreasouth = 'koreasouth',
	norwayeast = 'norwayeast',
	norwaywest = 'norwaywest',
	southafricanorth = 'southafricanorth',
	southafricawest = 'southafricawest',
	switzerlandnorth = 'switzerlandnorth',
	switzerlandwest = 'switzerlandwest',
	uaecentral = 'uaecentral',
	uaenorth = 'uaenorth',
	uksouth = 'uksouth',
	ukwest = 'ukwest',
	uscentral = 'uscentral',
	useast = 'useast',
	useast2 = 'useast2',
	usnorthcentral = 'usnorthcentral',
	ussouthcentral = 'ussouthcentral',
	uswest = 'uswest',
	uswest2 = 'uswest2',
	uswestcentral = 'uswestcentral'
}

export interface IExtension {
	/**
	 * Converts a region value (@see AzureRegion) into the localized Display Name
	 * @param region The region value
	 */
	getRegionDisplayName(region: string): string;
	provideResources(): azureResource.IAzureResourceProvider[];
}

export type GetSubscriptionsResult = { subscriptions: azureResource.AzureResourceSubscription[], errors: Error[] };
export type GetResourceGroupsResult = { resourceGroups: azureResource.AzureResourceResourceGroup[], errors: Error[] };

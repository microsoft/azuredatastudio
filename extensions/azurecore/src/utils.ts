/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as loc from './localizedConstants';
import { AzureRegion } from './azurecore';

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
		case AzureRegion.canadacentral:
			return loc.canadaCentral;
		case AzureRegion.canadaeast:
			return loc.canadaEast;
		case AzureRegion.centralindia:
			return loc.centralIndia;
		case AzureRegion.centralus:
			return loc.centralUS;
		case AzureRegion.eastasia:
			return loc.eastAsia;
		case AzureRegion.eastus:
			return loc.eastUS;
		case AzureRegion.eastus2:
			return loc.eastUS2;
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

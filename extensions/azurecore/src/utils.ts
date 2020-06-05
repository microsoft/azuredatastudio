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
		case AzureRegion.asiaeast:
			return loc.asiaEast;
		case AzureRegion.asiasoutheast:
			return loc.asiaSouthEast;
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
		case AzureRegion.chinaeast:
			return loc.chinaEast;
		case AzureRegion.chinaeast2:
			return loc.chinaEast2;
		case AzureRegion.chinanorth:
			return loc.chinaNorth;
		case AzureRegion.chinanorth2:
			return loc.chinaNorth2;
		case AzureRegion.europenorth:
			return loc.europeNorth;
		case AzureRegion.europewest:
			return loc.europeWest;
		case AzureRegion.francecentral:
			return loc.franceCentral;
		case AzureRegion.francesouth:
			return loc.franceSouth;
		case AzureRegion.germanycentral:
			return loc.germanyCentral;
		case AzureRegion.germanynorth:
			return loc.germanyNorth;
		case AzureRegion.germanynortheast:
			return loc.germanyNorthEast;
		case AzureRegion.germanywestcentral:
			return loc.germanyWestCentral;
		case AzureRegion.governmentusarizona:
			return loc.governmentUSArizona;
		case AzureRegion.governmentusdodcentral:
			return loc.governmentUSDodCentral;
		case AzureRegion.governmentusdodeast:
			return loc.governmentUSDodEast;
		case AzureRegion.governmentusiowa:
			return loc.governmentUSIowa;
		case AzureRegion.governmentustexas:
			return loc.governmentUSTexas;
		case AzureRegion.governmentusvirginia:
			return loc.governmentUSVirginia;
		case AzureRegion.indiacentral:
			return loc.indiaCentral;
		case AzureRegion.indiasouth:
			return loc.indiaSouth;
		case AzureRegion.indiawest:
			return loc.indiaWest;
		case AzureRegion.japaneast:
			return loc.japanEast;
		case AzureRegion.japanwest:
			return loc.japanWest;
		case AzureRegion.koreacentral:
			return loc.koreaCentral;
		case AzureRegion.koreasouth:
			return loc.koreaSouth;
		case AzureRegion.norwayeast:
			return loc.norwayEast;
		case AzureRegion.norwaywest:
			return loc.norwayWest;
		case AzureRegion.southafricanorth:
			return loc.southAfricaNorth;
		case AzureRegion.southafricawest:
			return loc.southAfricaWest;
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
		case AzureRegion.uscentral:
			return loc.usCentral;
		case AzureRegion.useast:
			return loc.usEast;
		case AzureRegion.useast2:
			return loc.usEast2;
		case AzureRegion.usnorthcentral:
			return loc.usNorthCentral;
		case AzureRegion.ussouthcentral:
			return loc.usSouthCentral;
		case AzureRegion.uswest:
			return loc.usWest;
		case AzureRegion.uswest2:
			return loc.usWest2;
		case AzureRegion.uswestcentral:
			return loc.usWestCentral;
	}
	console.warn(`Unknown Azure region ${region}`);
	return region;
}

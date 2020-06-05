/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as loc from './localizedConstants';

export function getRegionDisplayName(region?: string): string {
	region = (region ?? '').toLocaleLowerCase();

	switch (region) {
		case 'asiaeast':
			return loc.asiaEast;
		case 'asiasoutheast':
			return loc.asiaSouthEast;
		case 'australiacentral':
			return loc.australiaCentral;
		case 'australiacentral2':
			return loc.australiaCentral2;
		case 'australiaeast':
			return loc.australiaEast;
		case 'australiasoutheast':
			return loc.australiaSouthEast;
		case 'brazilsouth':
			return loc.brazilSouth;
		case 'canadacentral':
			return loc.canadaCentral;
		case 'canadaeast':
			return loc.canadaEast;
		case 'chinaeast':
			return loc.chinaEast;
		case 'chinaeast2':
			return loc.chinaEast2;
		case 'chinanorth':
			return loc.chinaNorth;
		case 'chinanorth2':
			return loc.chinaNorth2;
		case 'europenorth':
			return loc.europeNorth;
		case 'europewest':
			return loc.europeWest;
		case 'francecentral':
			return loc.franceCentral;
		case 'francesouth':
			return loc.franceSouth;
		case 'germanycentral':
			return loc.germanyCentral;
		case 'germanynorth':
			return loc.germanyNorth;
		case 'germanynortheast':
			return loc.germanyNorthEast;
		case 'germanywestcentral':
			return loc.germanyWestCentral;
		case 'governmentusarizona':
			return loc.governmentUSArizona;
		case 'governmentusdodcentral':
			return loc.governmentUSDodCentral;
		case 'governmentusdodeast':
			return loc.governmentUSDodEast;
		case 'governmentusiowa':
			return loc.governmentUSIowa;
		case 'governmentustexas':
			return loc.governmentUSTexas;
		case 'governmentusvirginia':
			return loc.governmentUSVirginia;
		case 'indiacentral':
			return loc.indiaCentral;
		case 'indiasouth':
			return loc.indiaSouth;
		case 'indiawest':
			return loc.indiaWest;
		case 'japaneast':
			return loc.japanEast;
		case 'japanwest':
			return loc.japanWest;
		case 'koreacentral':
			return loc.koreaCentral;
		case 'koreasouth':
			return loc.koreaSouth;
		case 'norwayeast':
			return loc.norwayEast;
		case 'norwaywest':
			return loc.norwayWest;
		case 'southafricanorth':
			return loc.southAfricaNorth;
		case 'southafricawest':
			return loc.southAfricaWest;
		case 'switzerlandnorth':
			return loc.switzerlandNorth;
		case 'switzerlandwest':
			return loc.switzerlandWest;
		case 'uaecentral':
			return loc.uaeCentral;
		case 'uaenorth':
			return loc.uaeNorth;
		case 'uksouth':
			return loc.ukSouth;
		case 'ukwest':
			return loc.ukWest;
		case 'uscentral':
			return loc.usCentral;
		case 'useast':
			return loc.usEast;
		case 'useast2':
			return loc.usEast2;
		case 'usnorthcentral':
			return loc.usNorthCentral;
		case 'ussouthcentral':
			return loc.usSouthCentral;
		case 'uswest':
			return loc.usWest;
		case 'uswest2':
			return loc.usWest2;
		case 'uswestcentral':
			return loc.usWestCentral;
	}
	console.warn(`Unknown Azure region ${region}`);
	return region;
}

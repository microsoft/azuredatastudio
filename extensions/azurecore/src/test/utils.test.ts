/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { getRegionDisplayName } from '../utils';
import { AzureRegion } from '../azurecore';
import * as loc from '../localizedConstants';

describe('Azurecore Utils Tests', function (): void {
	describe('getRegionDisplayName', function(): void {
		it('Returns expected name for valid regions', function(): void {
			should(getRegionDisplayName(AzureRegion.asiaeast)).equal(loc.asiaEast);
			should(getRegionDisplayName(AzureRegion.governmentusdodcentral)).equal(loc.governmentUSDodCentral);
			should(getRegionDisplayName(AzureRegion.uswestcentral)).equal(loc.usWestCentral);
		});

		it('Returns expected name for region regardless of case', function(): void {
			should(getRegionDisplayName(AzureRegion.asiaeast.toLocaleUpperCase())).equal(loc.asiaEast);
			should(getRegionDisplayName(AzureRegion.governmentusdodcentral.toLocaleUpperCase())).equal(loc.governmentUSDodCentral);
			should(getRegionDisplayName(AzureRegion.uswestcentral.toLocaleUpperCase())).equal(loc.usWestCentral);
		});

		it('Returns original name for unknown region', function(): void {
			const unknownRegion = 'UnknownRegion';
			should(getRegionDisplayName(unknownRegion)).equal(unknownRegion);
		});

		it('Returns empty name for undefined region', function(): void {
			should(getRegionDisplayName(undefined)).equal('');
		});

		it('Returns empty name for empty region', function(): void {
			should(getRegionDisplayName('')).equal('');
		});
	});
});

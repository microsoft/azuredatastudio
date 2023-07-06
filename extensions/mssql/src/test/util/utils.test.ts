/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as utils from '../../objectManagement/utils';


describe('Tests to verify utils functions', function (): void {
	it('convertNumToTwoDecimalStringInMB function should convert and return the passed integer value to string with two decimals and in MB units', () => {
		should(utils.convertNumToTwoDecimalStringInMB(0)).equals('0.00 MB', 'should return string value In MB with two decimals');
		should(utils.convertNumToTwoDecimalStringInMB(10)).equals('10.00 MB', 'should return string value In MB with two decimals');
		should(utils.convertNumToTwoDecimalStringInMB(10.23)).equals('10.23 MB', 'should return string value In MB with two decimals');
	});
});


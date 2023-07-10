/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';

describe('Test to verify test infrastructure is working', () => {
	it('Should run as expected', () => {
		const testNumber = true;
		should(testNumber).be.true();
	});
});

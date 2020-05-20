/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import { FilterErrorPath } from '../services/telemetry';
import { ensure } from '../services/serviceUtils';

describe('import extension services', function (): void {

	describe('telemetry', function (): void {
		it('filter error path', async () => {
			let inValidOutput = FilterErrorPath('invalidTestInput');
			should(inValidOutput).equal('invalidTestInput');
			let validOutput = FilterErrorPath('src/out/testFile.js');
			should(validOutput).equal('testFile.js');
		});
	});

	describe('service utility', function (): void {
		it('ensure', async () => {
			should(ensure({ 'testkey': 'testval' }, 'testkey')).equal('testval');
			should(ensure({ 'testkey1': 'testval' }, 'testkey')).deepEqual({});
		});
	});
});

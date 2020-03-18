/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';

import { MemoryDatabase } from '../../../account-provider/utils/memoryDatabase';

let memoryDatabase: MemoryDatabase<string>;

// These tests don't work on Linux systems because gnome-keyring doesn't like running on headless machines.
describe('AccountProvider.MemoryDatabase', function (): void {
	beforeEach(function (): void {
		memoryDatabase = new MemoryDatabase<string>();
	});
	it('set, get, and clear', async function (): Promise<void> {
		memoryDatabase.set('k1', 'v1');

		let val = memoryDatabase.get('k1');
		should(val).equal('v1');

		memoryDatabase.set('k1', 'v2');
		val = memoryDatabase.get('k1');
		should(val).be.equal('v2');

		memoryDatabase.delete('k1');
		val = memoryDatabase.get('k1');

		should(val).be.undefined();
	});

});

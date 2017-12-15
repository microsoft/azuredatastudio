/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { StorageService } from 'vs/platform/storage/common/storageService';
import { parseStorage, migrateStorageToMultiRootWorkspace } from 'vs/platform/storage/common/migration';
import URI from 'vs/base/common/uri';
import { StorageScope } from 'vs/platform/storage/common/storage';
import { startsWith } from 'vs/base/common/strings';

suite('Storage Migration', () => {
	//slet storage = window.localStorage;

	setup(() => {
		//storage.clear();
	});

	teardown(() => {
		//storage.clear();
	});

	test('Parse Storage (Global)', () => {
		// const service = createService();

		// const parsed = parseStorage(storage);

		// assert.equal(parsed.global.size, 4);
		// assert.equal(parsed.global.get('key1'), service.get('key1'));
		// assert.equal(parsed.global.get('key2.something'), service.get('key2.something'));
		// assert.equal(parsed.global.get('key3/special'), service.get('key3/special'));
		// assert.equal(parsed.global.get('key4 space'), service.get('key4 space'));
	});
});
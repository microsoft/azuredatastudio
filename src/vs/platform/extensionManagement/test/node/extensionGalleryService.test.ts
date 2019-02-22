/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as os from 'os';
import * as extfs from 'vs/base/node/extfs';
import { EnvironmentService } from 'vs/platform/environment/node/environmentService';
import { parseArgs } from 'vs/platform/environment/node/argv';
import { getRandomTestPath } from 'vs/workbench/test/workbenchTestServices';
import { join } from 'path';
import { mkdirp } from 'vs/base/node/pfs';
// {{SQL CARBON EDIT}}
import { resolveMarketplaceHeaders, ExtensionGalleryService } from 'vs/platform/extensionManagement/node/extensionGalleryService';
import { isUUID } from 'vs/base/common/uuid';

suite('Extension Gallery Service', () => {
	const parentDir = getRandomTestPath(os.tmpdir(), 'vsctests', 'extensiongalleryservice');
	const marketplaceHome = join(parentDir, 'Marketplace');

	setup(done => {

		// Delete any existing backups completely and then re-create it.
		extfs.del(marketplaceHome, os.tmpdir(), () => {
			mkdirp(marketplaceHome).then(() => {
				done();
			}, error => done(error));
		});
	});

	teardown(done => {
		extfs.del(marketplaceHome, os.tmpdir(), done);
	});

	test('marketplace machine id', () => {
		const args = ['--user-data-dir', marketplaceHome];
		const environmentService = new EnvironmentService(parseArgs(args), process.execPath);

		return resolveMarketplaceHeaders(environmentService).then(headers => {
			assert.ok(isUUID(headers['X-Market-User-Id']));

			return resolveMarketplaceHeaders(environmentService).then(headers2 => {
				assert.equal(headers['X-Market-User-Id'], headers2['X-Market-User-Id']);
			});
		});
	});

	// {{SQL CARBON EDIT}}
	test('sortByField', () => {
		let a = {
			extensionId: undefined,
			extensionName: undefined,
			displayName: undefined,
			shortDescription: undefined,
			publisher: undefined
		};
		let b = {
			extensionId: undefined,
			extensionName: undefined,
			displayName: undefined,
			shortDescription: undefined,
			publisher: undefined
		};


		assert.equal(ExtensionGalleryService.compareByField(a.publisher, b.publisher, 'publisherName'), 0);

		a.publisher = { displayName: undefined, publisherId: undefined, publisherName: undefined};
		assert.equal(ExtensionGalleryService.compareByField(a.publisher, b.publisher, 'publisherName'), 1);

		b.publisher = { displayName: undefined, publisherId: undefined, publisherName: undefined};
		assert.equal(ExtensionGalleryService.compareByField(a.publisher, b.publisher, 'publisherName'), 0);

		a.publisher.publisherName = 'a';
		assert.equal(ExtensionGalleryService.compareByField(a.publisher, b.publisher, 'publisherName'), 1);

		b.publisher.publisherName = 'b';
		assert.equal(ExtensionGalleryService.compareByField(a.publisher, b.publisher, 'publisherName'), -1);

		b.publisher.publisherName = 'a';
		assert.equal(ExtensionGalleryService.compareByField(a.publisher, b.publisher, 'publisherName'), 0);

		a.displayName = 'test1';
		assert.equal(ExtensionGalleryService.compareByField(a, b, 'displayName'), 1);

		b.displayName = 'test2';
		assert.equal(ExtensionGalleryService.compareByField(a, b, 'displayName'), -1);

		b.displayName = 'test1';
		assert.equal(ExtensionGalleryService.compareByField(a, b, 'displayName'), 0);
	});
});
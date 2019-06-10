/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as os from 'os';
import { EnvironmentService } from 'vs/platform/environment/node/environmentService';
import { parseArgs } from 'vs/platform/environment/node/argv';
import { getRandomTestPath } from 'vs/base/test/node/testUtils';
import { join } from 'vs/base/common/path';
import { mkdirp, RimRafMode, rimraf } from 'vs/base/node/pfs';
// {{SQL CARBON EDIT}}
import { resolveMarketplaceHeaders, ExtensionGalleryService } from 'vs/platform/extensionManagement/node/extensionGalleryService';
import { isUUID } from 'vs/base/common/uuid';

suite('Extension Gallery Service', () => {
	const parentDir = getRandomTestPath(os.tmpdir(), 'vsctests', 'extensiongalleryservice');
	const marketplaceHome = join(parentDir, 'Marketplace');

	setup(done => {

		// Delete any existing backups completely and then re-create it.
		rimraf(marketplaceHome, RimRafMode.MOVE).then(() => {
			mkdirp(marketplaceHome).then(() => {
				done();
			}, error => done(error));
		}, error => done(error));
	});

	teardown(done => {
		rimraf(marketplaceHome, RimRafMode.MOVE).then(done, done);
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
		let a: {
			extensionId: string | undefined;
			extensionName: string | undefined;
			displayName: string | undefined;
			shortDescription: string | undefined;
			publisher: { displayName: string | undefined, publisherId: string | undefined, publisherName: string | undefined; } | undefined;
		} = {
			extensionId: undefined,
			extensionName: undefined,
			displayName: undefined,
			shortDescription: undefined,
			publisher: undefined
		};
		let b: {
			extensionId: string | undefined;
			extensionName: string | undefined;
			displayName: string | undefined;
			shortDescription: string | undefined;
			publisher: { displayName: string | undefined, publisherId: string | undefined, publisherName: string | undefined; } | undefined;
		} = {
			extensionId: undefined,
			extensionName: undefined,
			displayName: undefined,
			shortDescription: undefined,
			publisher: undefined
		};


		assert.equal(ExtensionGalleryService.compareByField(a.publisher, b.publisher, 'publisherName'), 0);

		a.publisher = { displayName: undefined, publisherId: undefined, publisherName: undefined };
		assert.equal(ExtensionGalleryService.compareByField(a.publisher, b.publisher, 'publisherName'), 1);

		b.publisher = { displayName: undefined, publisherId: undefined, publisherName: undefined };
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

	// {{SQL CARBON EDIT}}
	test('isMatchingExtension', () => {
		let createEmptyExtension = () => {
			return {
				extensionId: '',
				extensionName: '',
				displayName: '',
				shortDescription: '',
				publisher: {
					displayName: '',
					publisherId: '',
					publisherName: ''
				},
				versions: [],
				statistics: [],
				flags: ''
			};
		};
		let searchText = 'tExt1 withSpace';
		let matchingText = 'test text1 Withspace test';
		let notMatchingText = 'test test';
		let extension;

		assert(!ExtensionGalleryService.isMatchingExtension(undefined, searchText), 'empty extension should not match any search text');

		extension = createEmptyExtension();
		assert(ExtensionGalleryService.isMatchingExtension(extension, undefined), 'empty search text should match any not null extension');

		extension = createEmptyExtension();
		extension.extensionName = notMatchingText;
		assert(!ExtensionGalleryService.isMatchingExtension(extension, searchText), 'invalid search text should not match extension');

		extension = createEmptyExtension();
		extension.extensionId = matchingText;
		assert(ExtensionGalleryService.isMatchingExtension(extension, searchText), 'extensionid field should be used for matching');

		extension = createEmptyExtension();
		extension.extensionName = matchingText;
		assert(ExtensionGalleryService.isMatchingExtension(extension, searchText), 'extensionName field should be used for matching');

		extension = createEmptyExtension();
		extension.displayName = matchingText;
		assert(ExtensionGalleryService.isMatchingExtension(extension, searchText), 'displayName field should be used for matching');

		extension = createEmptyExtension();
		extension.shortDescription = matchingText;
		assert(ExtensionGalleryService.isMatchingExtension(extension, searchText), 'shortDescription field should be used for matching');

		extension = createEmptyExtension();
		extension.publisher.displayName = matchingText;
		assert(ExtensionGalleryService.isMatchingExtension(extension, searchText), 'publisher displayName field should be used for matching');

		extension = createEmptyExtension();
		extension.publisher.publisherName = matchingText;
		assert(ExtensionGalleryService.isMatchingExtension(extension, searchText), 'publisher publisherName field should be used for matching');
	});
});

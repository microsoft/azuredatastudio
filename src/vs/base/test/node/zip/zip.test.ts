/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'vs/base/common/path';
import { tmpdir } from 'os';
import { extract } from 'vs/base/node/zip';
import { Promises } from 'vs/base/node/pfs';
import { createCancelablePromise } from 'vs/base/common/async';
import { getRandomTestPath, getPathFromAmdModule } from 'vs/base/test/node/testUtils';

suite('Zip', () => {

	let testDir: string;

	setup(() => {
		testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip');

		return Promises.mkdir(testDir, { recursive: true });
	});

	teardown(() => {
		return Promises.rm(testDir);
	});

	test('extract should handle directories', async () => {
		const fixtures = getPathFromAmdModule(require, './fixtures');
		const fixture = path.join(fixtures, 'extract.zip');

		await createCancelablePromise(token => extract(fixture, testDir, {}, token));
		const doesExist = await Promises.exists(path.join(testDir, 'extension'));
		assert(doesExist);
	});
});

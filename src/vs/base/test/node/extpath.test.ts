/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { tmpdir } from 'os';
import { realcase, realcaseSync, realpath, realpathSync } from 'vs/base/node/extpath';
import { Promises } from 'vs/base/node/pfs';
import { flakySuite, getRandomTestPath } from 'vs/base/test/node/testUtils';

flakySuite('Extpath', () => {
	let testDir: string;

	setup(() => {
		testDir = getRandomTestPath(tmpdir(), 'vsctests', 'extpath');

		return Promises.mkdir(testDir, { recursive: true });
	});

	teardown(() => {
		return Promises.rm(testDir);
	});

	test('realcaseSync', async () => {

		// assume case insensitive file system
		if (process.platform === 'win32' || process.platform === 'darwin') {
			const upper = testDir.toUpperCase();
			const real = realcaseSync(upper);

			if (real) { // can be null in case of permission errors
				assert.notStrictEqual(real, upper);
				assert.strictEqual(real.toUpperCase(), upper);
				assert.strictEqual(real, testDir);
			}
		}

		// linux, unix, etc. -> assume case sensitive file system
		else {
			let real = realcaseSync(testDir);
			assert.strictEqual(real, testDir);

			real = realcaseSync(testDir.toUpperCase());
			assert.strictEqual(real, testDir.toUpperCase());
		}
	});

	test('realcase', async () => {

		// assume case insensitive file system
		if (process.platform === 'win32' || process.platform === 'darwin') {
			const upper = testDir.toUpperCase();
			const real = await realcase(upper);

			if (real) { // can be null in case of permission errors
				assert.notStrictEqual(real, upper);
				assert.strictEqual(real.toUpperCase(), upper);
				assert.strictEqual(real, testDir);
			}
		}

		// linux, unix, etc. -> assume case sensitive file system
		else {
			let real = await realcase(testDir);
			assert.strictEqual(real, testDir);

			real = await realcase(testDir.toUpperCase());
			assert.strictEqual(real, testDir.toUpperCase());
		}
	});

	test('realpath', async () => {
		const realpathVal = await realpath(testDir);
		assert.ok(realpathVal);
	});

	test('realpathSync', () => {
		const realpath = realpathSync(testDir);
		assert.ok(realpath);
	});
});

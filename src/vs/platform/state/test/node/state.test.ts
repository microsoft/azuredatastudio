/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as os from 'os';
import * as path from 'vs/base/common/path';
import { getRandomTestPath } from 'vs/base/test/node/testUtils';
import { FileStorage } from 'vs/platform/state/node/stateService';
import { mkdirp, rimraf, RimRafMode, writeFileSync } from 'vs/base/node/pfs';

suite('StateService', () => {
	const parentDir = getRandomTestPath(os.tmpdir(), 'vsctests', 'stateservice');
	const storageFile = path.join(parentDir, 'storage.json');

	teardown(done => {
		rimraf(parentDir, RimRafMode.MOVE).then(done, done);
	});

	test('Basics', () => {
		return mkdirp(parentDir).then(() => {
			writeFileSync(storageFile, '');

			let service = new FileStorage(storageFile, () => null);

			service.setItem('some.key', 'some.value');
			assert.equal(service.getItem('some.key'), 'some.value');

			service.removeItem('some.key');
			assert.equal(service.getItem('some.key', 'some.default'), 'some.default');

			assert.ok(!service.getItem('some.unknonw.key'));

			service.setItem('some.other.key', 'some.other.value');

			service = new FileStorage(storageFile, () => null);

			assert.equal(service.getItem('some.other.key'), 'some.other.value');

			service.setItem('some.other.key', 'some.other.value');
			assert.equal(service.getItem('some.other.key'), 'some.other.value');

			service.setItem('some.undefined.key', undefined);
			assert.equal(service.getItem('some.undefined.key', 'some.default'), 'some.default');

			service.setItem('some.null.key', null);
			assert.equal(service.getItem('some.null.key', 'some.default'), 'some.default');
		});
	});
});
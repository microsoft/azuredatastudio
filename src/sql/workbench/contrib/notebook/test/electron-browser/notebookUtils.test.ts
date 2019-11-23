/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { nb } from 'azdata';

import { tryMatchCellMagic, getHostAndPortFromEndpoint, isStream } from 'sql/workbench/contrib/notebook/browser/models/notebookUtils';

suite('notebookUtils', function (): void {
	test('isStream Test', async function (): Promise<void> {
		let result = isStream(<nb.ICellOutput>{
			output_type: 'stream'
		});
		assert.strictEqual(result, true);

		result = isStream(<nb.ICellOutput>{
			output_type: 'display_data'
		});
		assert.strictEqual(result, false);

		result = isStream(<nb.ICellOutput>{
			output_type: undefined
		});
		assert.strictEqual(result, false);
	});

	test('getProvidersForFileName Test', async function (): Promise<void> {

	});

	test('getStandardKernelsForProvider Test', async function (): Promise<void> {

	});

	test('tryMatchCellMagic Test', async function (): Promise<void> {
		let result = tryMatchCellMagic(undefined);
		assert.equal(result, undefined);

		result = tryMatchCellMagic('    ');
		assert.equal(result, undefined);

		result = tryMatchCellMagic('text');
		assert.equal(result, undefined);

		result = tryMatchCellMagic('%%sql');
		assert.equal(result, 'sql');

		result = tryMatchCellMagic('%%');
		assert.equal(result, undefined);

		result = tryMatchCellMagic('%% sql');
		assert.equal(result, undefined);
	});

	test('getHostAndPortFromEndpoint Test', async function (): Promise<void> {
		let result = getHostAndPortFromEndpoint('https://localhost:1433');
		assert.equal(result.host, 'localhost');
		assert.equal(result.port, '1433');

		result = getHostAndPortFromEndpoint('tcp://localhost,1433');
		assert.equal(result.host, 'localhost');
		assert.equal(result.port, '1433');

		result = getHostAndPortFromEndpoint('tcp://localhost');
		assert.equal(result.host, 'localhost');
		assert.equal(result.port, undefined);

		result = getHostAndPortFromEndpoint('localhost');
		assert.equal(result.host, '');
		assert.equal(result.port, undefined);

		result = getHostAndPortFromEndpoint('localhost:1433');
		assert.equal(result.host, '');
		assert.equal(result.port, undefined);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';

import { nb } from 'azdata';
import { tryMatchCellMagic, getHostAndPortFromEndpoint, isStream, getProvidersForFileName } from 'sql/workbench/contrib/notebook/browser/models/notebookUtils';
import { INotebookService, DEFAULT_NOTEBOOK_FILETYPE, DEFAULT_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookServiceStub } from 'sql/workbench/contrib/notebook/test/electron-browser/common';

suite('notebookUtils', function (): void {
	const mockNotebookService = TypeMoq.Mock.ofType<INotebookService>(NotebookServiceStub);
	const defaultTestProvider = 'testDefaultProvider';
	const testProvider = 'testProvider';

	function setupMockNotebookService() {
		mockNotebookService.setup(n => n.getProvidersForFileType(TypeMoq.It.isAnyString()))
			.returns((fileName, service) => {
				if (fileName === DEFAULT_NOTEBOOK_FILETYPE) {
					return [defaultTestProvider];
				} else {
					return [testProvider];
				}
			});
	}

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
		setupMockNotebookService();

		let result = getProvidersForFileName('', mockNotebookService.object);
		assert.deepStrictEqual(result, [defaultTestProvider]);

		result = getProvidersForFileName('fileWithoutExtension', mockNotebookService.object);
		assert.deepStrictEqual(result, [defaultTestProvider]);

		result = getProvidersForFileName('test.sql', mockNotebookService.object);
		assert.deepStrictEqual(result, [testProvider]);

		mockNotebookService.setup(n => n.getProvidersForFileType(TypeMoq.It.isAnyString()))
			.returns(() => undefined);
		result = getProvidersForFileName('test.sql', mockNotebookService.object);
		assert.deepStrictEqual(result, [DEFAULT_NOTEBOOK_PROVIDER]);
	});

	test('getStandardKernelsForProvider Test', async function (): Promise<void> {
		setupMockNotebookService();
	});

	test('tryMatchCellMagic Test', async function (): Promise<void> {
		let result = tryMatchCellMagic(undefined);
		assert.strictEqual(result, undefined);

		result = tryMatchCellMagic('    ');
		assert.strictEqual(result, undefined);

		result = tryMatchCellMagic('text');
		assert.strictEqual(result, undefined);

		result = tryMatchCellMagic('%%sql');
		assert.strictEqual(result, 'sql');

		result = tryMatchCellMagic('%%');
		assert.strictEqual(result, undefined);

		result = tryMatchCellMagic('%% sql');
		assert.strictEqual(result, undefined);
	});

	test('getHostAndPortFromEndpoint Test', async function (): Promise<void> {
		let result = getHostAndPortFromEndpoint('https://localhost:1433');
		assert.strictEqual(result.host, 'localhost');
		assert.strictEqual(result.port, '1433');

		result = getHostAndPortFromEndpoint('tcp://localhost,1433');
		assert.strictEqual(result.host, 'localhost');
		assert.strictEqual(result.port, '1433');

		result = getHostAndPortFromEndpoint('tcp://localhost');
		assert.strictEqual(result.host, 'localhost');
		assert.strictEqual(result.port, undefined);

		result = getHostAndPortFromEndpoint('localhost');
		assert.strictEqual(result.host, '');
		assert.strictEqual(result.port, undefined);

		result = getHostAndPortFromEndpoint('localhost:1433');
		assert.strictEqual(result.host, '');
		assert.strictEqual(result.port, undefined);
	});
});

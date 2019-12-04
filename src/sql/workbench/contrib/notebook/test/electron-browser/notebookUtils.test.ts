/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';

import { nb, ServerInfo } from 'azdata';
import { tryMatchCellMagic, getHostAndPortFromEndpoint, isStream, getProvidersForFileName, asyncForEach, clusterEndpointsProperty, getClusterEndpoints, RawEndpoint, IEndpoint, getStandardKernelsForProvider, IStandardKernelWithProvider } from 'sql/workbench/contrib/notebook/browser/models/notebookUtils';
import { INotebookService, DEFAULT_NOTEBOOK_FILETYPE, DEFAULT_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookServiceStub } from 'sql/workbench/contrib/notebook/test/electron-browser/common';

suite('notebookUtils', function (): void {
	const mockNotebookService = TypeMoq.Mock.ofType<INotebookService>(NotebookServiceStub);
	const defaultTestProvider = 'testDefaultProvider';
	const testProvider = 'testProvider';
	const testKernel: nb.IStandardKernel = {
		name: 'testName',
		displayName: 'testDisplayName',
		connectionProviderIds: ['testId1', 'testId2']
	};

	function setupMockNotebookService() {
		mockNotebookService.setup(n => n.getProvidersForFileType(TypeMoq.It.isAnyString()))
			.returns((fileName, service) => {
				if (fileName === DEFAULT_NOTEBOOK_FILETYPE) {
					return [defaultTestProvider];
				} else {
					return [testProvider];
				}
			});

		// getStandardKernelsForProvider
		mockNotebookService.setup(n => n.getStandardKernelsForProvider(TypeMoq.It.isAnyString()))
			.returns((provider) => {
				return [testKernel];
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

		let result = getStandardKernelsForProvider(undefined, undefined);
		assert.deepStrictEqual(result, []);

		result = getStandardKernelsForProvider(undefined, mockNotebookService.object);
		assert.deepStrictEqual(result, []);

		result = getStandardKernelsForProvider('testProvider', undefined);
		assert.deepStrictEqual(result, []);

		result = getStandardKernelsForProvider('testProvider', mockNotebookService.object);
		assert.deepStrictEqual(result, [<IStandardKernelWithProvider>{
			name: 'testName',
			displayName: 'testDisplayName',
			connectionProviderIds: ['testId1', 'testId2'],
			notebookProvider: 'testProvider'
		}]);
	});

	test('tryMatchCellMagic Test', async function (): Promise<void> {
		let result = tryMatchCellMagic(undefined);
		assert.strictEqual(result, undefined);

		result = tryMatchCellMagic('    ');
		assert.strictEqual(result, null);

		result = tryMatchCellMagic('text');
		assert.strictEqual(result, null);

		result = tryMatchCellMagic('%%sql');
		assert.strictEqual(result, 'sql');

		result = tryMatchCellMagic('%%sql\nselect @@VERSION\nselect * from TestTable');
		assert.strictEqual(result, 'sql');

		result = tryMatchCellMagic('%%sql\n%%help');
		assert.strictEqual(result, 'sql');

		result = tryMatchCellMagic('%%');
		assert.strictEqual(result, null);

		result = tryMatchCellMagic('%% sql');
		assert.strictEqual(result, null);
	});

	test('asyncForEach Test', async function (): Promise<void> {
		let totalResult = 0;
		await asyncForEach([1, 2, 3, 4], async (value) => {
			totalResult += value;
		});
		assert.strictEqual(totalResult, 10);

		totalResult = 0;
		await asyncForEach([], async (value) => {
			totalResult += value;
		});
		assert.strictEqual(totalResult, 0);

		// Shouldn't throw exceptions for these cases
		await asyncForEach(undefined, async (value) => {
			totalResult += value;
		});
		assert.strictEqual(totalResult, 0);

		await asyncForEach([1, 2, 3, 4], undefined);
	});

	test('getClusterEndpoints Test', async function (): Promise<void> {
		let serverInfo = <ServerInfo>{
			options: {}
		};

		serverInfo.options[clusterEndpointsProperty] = undefined;
		let result = getClusterEndpoints(serverInfo);
		assert.deepStrictEqual(result, []);

		serverInfo.options[clusterEndpointsProperty] = [];
		result = getClusterEndpoints(serverInfo);
		assert.deepStrictEqual(result, []);

		let testEndpoint = <RawEndpoint>{
			serviceName: 'testName',
			description: 'testDescription',
			endpoint: 'testEndpoint',
			protocol: 'testProtocol',
			ipAddress: 'testIpAddress',
			port: 1433
		};
		serverInfo.options[clusterEndpointsProperty] = [testEndpoint];
		result = getClusterEndpoints(serverInfo);
		assert.deepStrictEqual(result, [<IEndpoint>{
			serviceName: testEndpoint.serviceName,
			description: testEndpoint.description,
			endpoint: testEndpoint.endpoint,
			protocol: testEndpoint.protocol
		}]);

		testEndpoint.endpoint = undefined;
		result = getClusterEndpoints(serverInfo);
		assert.deepStrictEqual(result, [<IEndpoint>{
			serviceName: testEndpoint.serviceName,
			description: testEndpoint.description,
			endpoint: 'https://testIpAddress:1433',
			protocol: testEndpoint.protocol
		}]);
	});

	test('getHostAndPortFromEndpoint Test', async function (): Promise<void> {
		let result = getHostAndPortFromEndpoint('https://localhost:1433');
		assert.strictEqual(result.host, 'localhost');
		assert.strictEqual(result.port, '1433');

		result = getHostAndPortFromEndpoint('tcp://localhost,12345');
		assert.strictEqual(result.host, 'localhost');
		assert.strictEqual(result.port, '12345');

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

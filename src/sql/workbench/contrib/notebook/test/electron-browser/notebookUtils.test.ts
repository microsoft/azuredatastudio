/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';

import { nb, ServerInfo } from 'azdata';
import { getHostAndPortFromEndpoint, isStream, getProvidersForFileName, asyncForEach, clusterEndpointsProperty, getClusterEndpoints, RawEndpoint, IEndpoint, getStandardKernelsForProvider, IStandardKernelWithProvider, rewriteUrlUsingRegex } from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { INotebookService, DEFAULT_NOTEBOOK_FILETYPE, DEFAULT_NOTEBOOK_PROVIDER, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookServiceStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { tryMatchCellMagic, extractCellMagicCommandPlusArgs } from 'sql/workbench/services/notebook/browser/utils';
import { RichTextEditStack } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { notebookConstants } from 'sql/workbench/services/notebook/browser/interfaces';

suite('notebookUtils', function (): void {
	const mockNotebookService = TypeMoq.Mock.ofType<INotebookService>(NotebookServiceStub);
	const defaultTestProvider = 'testDefaultProvider';
	const testProvider = 'testProvider';
	const testKernel: nb.IStandardKernel = {
		name: 'testName',
		displayName: 'testDisplayName',
		connectionProviderIds: ['testId1', 'testId2']
	};
	const sqlStandardKernel: nb.IStandardKernel = {
		name: notebookConstants.SQL,
		displayName: notebookConstants.SQL,
		connectionProviderIds: [notebookConstants.SQL_CONNECTION_PROVIDER]
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
		let returnHandler = (provider) => {
			if (provider === testProvider) {
				return [testKernel];
			} else if (provider === SQL_NOTEBOOK_PROVIDER) {
				return [sqlStandardKernel];
			} else {
				return undefined;
			}
		};
		mockNotebookService.setup(n => n.getStandardKernelsForProvider(TypeMoq.It.isAnyString())).returns(returnHandler);
		mockNotebookService.setup(n => n.getStandardKernelsForProvider(TypeMoq.It.isAnyString())).returns(returnHandler);
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

		result = getStandardKernelsForProvider('NotARealProvider', mockNotebookService.object);
		assert.deepStrictEqual(result, [Object.assign({ notebookProvider: 'NotARealProvider' }, sqlStandardKernel)]);

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

	test('extractCellMagicCommandPlusArgs Test', async function (): Promise<void> {
		let result = extractCellMagicCommandPlusArgs(undefined, undefined);
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('test', undefined);
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs(undefined, 'test');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('%%magic', 'magic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('%%magic ', 'magic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('magic', 'magic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('magic ', 'magic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('%%magic command', 'otherMagic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('%%magiccommand', 'magic');
		assert.strictEqual(result, undefined);

		result = extractCellMagicCommandPlusArgs('%%magic command', 'magic');
		assert.strictEqual(result.commandId, 'command');
		assert.strictEqual(result.args, '');

		result = extractCellMagicCommandPlusArgs('%%magic command arg1', 'magic');
		assert.strictEqual(result.commandId, 'command');
		assert.strictEqual(result.args, 'arg1');

		result = extractCellMagicCommandPlusArgs('%%magic command arg1 arg2', 'magic');
		assert.strictEqual(result.commandId, 'command');
		assert.strictEqual(result.args, 'arg1 arg2');

		result = extractCellMagicCommandPlusArgs('%%magic command.id arg1 arg2 arg3', 'magic');
		assert.strictEqual(result.commandId, 'command.id');
		assert.strictEqual(result.args, 'arg1 arg2 arg3');
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

	test('rewriteUrlUsingRegex Test', async function (): Promise<void> {
		// Give a URL that should be rewritten
		let html = '<a target="_blank" href="https://sparkhead-0.sparkhead-svc:8090/proxy/application_1/“>Link</a>';
		let result = rewriteUrlUsingRegex(/(https?:\/\/sparkhead.*\/proxy)(.*)/g, html, '1.1.1.1', ':999', '/gateway/default/yarn/proxy');
		assert.strictEqual(result, '<a target="_blank" href="https://1.1.1.1:999/gateway/default/yarn/proxy/application_1/“>Link</a>', 'Target URL does not match after substitution');

		// Give a URL that should not be rewritten
		html = '<a target="_blank" href="https://storage-0-0.storage-0-svc.mssql-cluster.svc.cluster.local:8044/node/containerlogs/container_7/root“>Link</a>';
		result = rewriteUrlUsingRegex(/(https?:\/\/sparkhead.*\/proxy)(.*)/g, html, '1.1.1.1', ':999', '/gateway/default/yarn/proxy');
		assert.strictEqual(result, '<a target="_blank" href="https://storage-0-0.storage-0-svc.mssql-cluster.svc.cluster.local:8044/node/containerlogs/container_7/root“>Link</a>', 'Target URL should not have been edited');
	});

	test('EditStack test', async function (): Promise<void> {
		let maxStackSize = 200;
		let stack = new RichTextEditStack(maxStackSize);
		assert.strictEqual(stack.count, 0);

		stack.push('1');
		stack.push('2');
		stack.push('3');
		assert.strictEqual(stack.count, 3);

		assert.strictEqual(stack.peek(), '3');

		let topElement = stack.pop();
		assert.strictEqual(topElement, '3');

		topElement = stack.pop();
		assert.strictEqual(topElement, '2');

		stack.push('4');
		assert.strictEqual(stack.count, 2);
		topElement = stack.pop();
		assert.strictEqual(topElement, '4');

		stack.clear();
		assert.strictEqual(stack.count, 0);
		topElement = stack.pop();
		assert.strictEqual(topElement, undefined);
		assert.strictEqual(stack.peek(), undefined);

		// Check max stack size
		stack.clear();
		for (let i = 0; i < maxStackSize; i++) {
			stack.push('a');
		}
		stack.push('b');
		assert.strictEqual(stack.count, maxStackSize);
		assert.strictEqual(stack.peek(), 'b');

		// update max stack size and add new element
		maxStackSize = 20;
		stack.maxStackSize = maxStackSize;
		stack.push('c');
		assert.strictEqual(stack.count, maxStackSize);
		assert.strictEqual(stack.peek(), 'c');
	});
});

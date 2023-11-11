/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ISearchService, IFileQuery } from 'vs/workbench/services/search/common/search';
import { MainThreadWorkspace } from 'vs/workbench/api/browser/mainThreadWorkspace';
import * as assert from 'assert';
import { SingleProxyRPCProtocol } from 'vs/workbench/api/test/common/testRPCProtocol';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { DisposableStore } from 'vs/base/common/lifecycle';

suite('MainThreadWorkspace', () => {

	let disposables: DisposableStore;
	let configService: TestConfigurationService;
	let instantiationService: TestInstantiationService;

	setup(() => {
		disposables = new DisposableStore();
		instantiationService = workbenchInstantiationService(undefined, disposables) as TestInstantiationService;

		configService = instantiationService.get(IConfigurationService) as TestConfigurationService;
		configService.setUserConfiguration('search', {});
	});

	teardown(() => {
		disposables.dispose();
	});

	test('simple', () => {
		instantiationService.stub(ISearchService, {
			fileSearch(query: IFileQuery) {
				assert.strictEqual(query.folderQueries.length, 1);
				assert.strictEqual(query.folderQueries[0].disregardIgnoreFiles, true);

				assert.deepStrictEqual({ ...query.includePattern }, { 'foo': true });
				assert.strictEqual(query.maxResults, 10);

				return Promise.resolve({ results: [], messages: [] });
			}
		});

		const mtw = instantiationService.createInstance(MainThreadWorkspace, SingleProxyRPCProtocol({ $initializeWorkspace: () => { } }));
		return mtw.$startFileSearch('foo', null, null, 10, new CancellationTokenSource().token);
	});

	test('exclude defaults', () => {
		configService.setUserConfiguration('search', {
			'exclude': { 'searchExclude': true }
		});
		configService.setUserConfiguration('files', {
			'exclude': { 'filesExclude': true }
		});

		instantiationService.stub(ISearchService, {
			fileSearch(query: IFileQuery) {
				assert.strictEqual(query.folderQueries.length, 1);
				assert.strictEqual(query.folderQueries[0].disregardIgnoreFiles, true);
				assert.deepStrictEqual(query.folderQueries[0].excludePattern, { 'filesExclude': true });

				return Promise.resolve({ results: [], messages: [] });
			}
		});

		const mtw = instantiationService.createInstance(MainThreadWorkspace, SingleProxyRPCProtocol({ $initializeWorkspace: () => { } }));
		return mtw.$startFileSearch('', null, null, 10, new CancellationTokenSource().token);
	});

	test('disregard excludes', () => {
		configService.setUserConfiguration('search', {
			'exclude': { 'searchExclude': true }
		});
		configService.setUserConfiguration('files', {
			'exclude': { 'filesExclude': true }
		});

		instantiationService.stub(ISearchService, {
			fileSearch(query: IFileQuery) {
				assert.strictEqual(query.folderQueries[0].excludePattern, undefined);
				assert.deepStrictEqual(query.excludePattern, undefined);

				return Promise.resolve({ results: [], messages: [] });
			}
		});

		const mtw = instantiationService.createInstance(MainThreadWorkspace, SingleProxyRPCProtocol({ $initializeWorkspace: () => { } }));
		return mtw.$startFileSearch('', null, false, 10, new CancellationTokenSource().token);
	});

	test('exclude string', () => {
		instantiationService.stub(ISearchService, {
			fileSearch(query: IFileQuery) {
				assert.strictEqual(query.folderQueries[0].excludePattern, undefined);
				assert.deepStrictEqual({ ...query.excludePattern }, { 'exclude/**': true });

				return Promise.resolve({ results: [], messages: [] });
			}
		});

		const mtw = instantiationService.createInstance(MainThreadWorkspace, SingleProxyRPCProtocol({ $initializeWorkspace: () => { } }));
		return mtw.$startFileSearch('', null, 'exclude/**', 10, new CancellationTokenSource().token);
	});
});

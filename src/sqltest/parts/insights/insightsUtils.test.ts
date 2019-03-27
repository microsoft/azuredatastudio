/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { equal } from 'assert';
import * as os from 'os';

import { InsightsUtils } from 'sql/workbench/services/insights/common/insightsUtils';
import { TestWindowService } from 'sqltest/stubs/windowTestService';

import * as path from 'vs/base/common/path';
import * as pfs from 'vs/base/node/pfs';

import { getRandomTestPath } from 'vs/base/test/node/testUtils';
import { Workspace, toWorkspaceFolders } from 'vs/platform/workspace/common/workspace';
import { ConfigurationResolverService } from 'vs/workbench/services/configurationResolver/browser/configurationResolverService';
import { TestContextService } from 'vs/workbench/test/workbenchTestServices';

suite('Insights Utils tests', function() {
	let testRootPath: string;
	let queryFileDir: string;
	let queryFilePath: string;

	setup( done => {
		// Create test file - just needs to exist for verifying the path resolution worked correctly
		testRootPath = path.join(os.tmpdir(), 'adstests');
		queryFileDir = getRandomTestPath(testRootPath, 'insightsutils');
		pfs.mkdirp(queryFileDir).then(() => {
			queryFilePath = path.join(queryFileDir, 'test.sql');
			pfs.writeFile(queryFilePath, '').then(done());
		});

	});

	test('resolveQueryFilePath resolves path correctly with fully qualified path', () => {
		let configurationResolverService = new ConfigurationResolverService(
			new TestWindowService( { } ),
			undefined,
			undefined,
			undefined,
			undefined,
			new TestContextService(),
			undefined);

		let resolvedPath = InsightsUtils.resolveQueryFilePath(queryFilePath, new TestContextService(), configurationResolverService);
		equal(resolvedPath, queryFilePath);
	});

	test('resolveQueryFilePath resolves path correctly with workspaceRoot var', () => {
		// Create mock context service with our test folder added as a workspace folder for resolution
		let contextService = new TestContextService(
			new Workspace(
				'TestWorkspace',
				toWorkspaceFolders([{ path: queryFileDir }])
		));
		let configurationResolverService = new ConfigurationResolverService(
			new TestWindowService( { } ),
			undefined,
			undefined,
			undefined,
			undefined,
			contextService,
			undefined);

		let resolvedPath = InsightsUtils.resolveQueryFilePath('${workspaceRoot}\\test.sql', contextService, configurationResolverService)
		equal(resolvedPath, queryFilePath);
	});

	test('resolveQueryFilePath resolves path correctly with env var', () => {
		// Create mock window service with env variable containing test folder for resolution
		let configurationResolverService = new ConfigurationResolverService(
			new TestWindowService({ TEST_PATH: queryFileDir }),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined);

		let resolvedPath = InsightsUtils.resolveQueryFilePath('${env:TEST_PATH}\\test.sql', new TestContextService(), configurationResolverService)
		equal(resolvedPath, queryFilePath);
	});

	teardown( done => {
		// Clean up our test files
		pfs.del(testRootPath).then(done());
	});

});

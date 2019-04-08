/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { equal } from 'assert';
import * as os from 'os';

import { resolveQueryFilePath } from 'sql/workbench/services/insights/common/insightsUtils';
import { TestWindowService } from 'sqltest/stubs/windowTestService';

import * as path from 'vs/base/common/path';
import * as pfs from 'vs/base/node/pfs';

import { getRandomTestPath } from 'vs/base/test/node/testUtils';
import { Workspace, toWorkspaceFolders } from 'vs/platform/workspace/common/workspace';
import { ConfigurationResolverService } from 'vs/workbench/services/configurationResolver/browser/configurationResolverService';
import { TestContextService } from 'vs/workbench/test/workbenchTestServices';

suite('Insights Utils tests', function () {
	let testRootPath: string;
	let queryFileDir: string;
	let queryFilePath: string;

	suiteSetup(done => {
		// Create test file - just needs to exist for verifying the path resolution worked correctly
		testRootPath = path.join(os.tmpdir(), 'adstests');
		queryFileDir = getRandomTestPath(testRootPath, 'insightsutils');
		pfs.mkdirp(queryFileDir).then(() => {
			queryFilePath = path.join(queryFileDir, 'test.sql');
			pfs.writeFile(queryFilePath, '').then(done());
		});

	});

	test('resolveQueryFilePath resolves path correctly with fully qualified path', async () => {
		let configurationResolverService = new ConfigurationResolverService(
			new TestWindowService({}),
			undefined,
			undefined,
			undefined,
			undefined,
			new TestContextService(),
			undefined);

		let resolvedPath = await resolveQueryFilePath(queryFilePath, new TestContextService(), configurationResolverService);
		equal(resolvedPath, queryFilePath);
	});

	test('resolveQueryFilePath resolves path correctly with workspaceRoot var and non-empty workspace containing file', async () => {
		// Create mock context service with our test folder added as a workspace folder for resolution
		let contextService = new TestContextService(
			new Workspace(
				'TestWorkspace',
				toWorkspaceFolders([{ path: queryFileDir }])
			));
		let configurationResolverService = new ConfigurationResolverService(
			new TestWindowService({}),
			undefined,
			undefined,
			undefined,
			undefined,
			contextService,
			undefined);

		let resolvedPath = await resolveQueryFilePath(path.join('${workspaceRoot}', 'test.sql'), contextService, configurationResolverService);
		equal(resolvedPath, queryFilePath);
	});

	test('resolveQueryFilePath throws with workspaceRoot var and non-empty workspace not containing file', async (done) => {
		let tokenizedPath = path.join('${workspaceRoot}', 'test.sql');
		// Create mock context service with a folder NOT containing our test file to verify it returns original path
		let contextService = new TestContextService(
			new Workspace(
				'TestWorkspace',
				toWorkspaceFolders([{ path: os.tmpdir() }])
			));
		let configurationResolverService = new ConfigurationResolverService(
			new TestWindowService({}),
			undefined,
			undefined,
			undefined,
			undefined,
			contextService,
			undefined);

		try {
			await resolveQueryFilePath(tokenizedPath, contextService, configurationResolverService);
		}
		catch (e) {
			done();
		}
	});

	test('resolveQueryFilePath throws with workspaceRoot var and empty workspace', async (done) => {
		let tokenizedPath = path.join('${workspaceRoot}', 'test.sql');
		// Create mock context service with an empty workspace
		let contextService = new TestContextService(
			new Workspace(
				'TestWorkspace'));
		let configurationResolverService = new ConfigurationResolverService(
			new TestWindowService({}),
			undefined,
			undefined,
			undefined,
			undefined,
			contextService,
			undefined);

		try {
			await resolveQueryFilePath(tokenizedPath, contextService, configurationResolverService);
		}
		catch (e) {
			done();
		}
	});

	test('resolveQueryFilePath resolves path correctly with env var and empty workspace', async () => {
		let contextService = new TestContextService(
			new Workspace('TestWorkspace'));

		// Create mock window service with env variable containing test folder for resolution
		let configurationResolverService = new ConfigurationResolverService(
			new TestWindowService({ TEST_PATH: queryFileDir }),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined);

		let resolvedPath = await resolveQueryFilePath(path.join('${env:TEST_PATH}', 'test.sql'), contextService, configurationResolverService);
		equal(resolvedPath, queryFilePath);
	});

	test('resolveQueryFilePath resolves path correctly with env var and non-empty workspace', async () => {
		let contextService = new TestContextService(
			new Workspace('TestWorkspace', toWorkspaceFolders([{ path: os.tmpdir() }])));

		// Create mock window service with env variable containing test folder for resolution
		let configurationResolverService = new ConfigurationResolverService(
			new TestWindowService({ TEST_PATH: queryFileDir }),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined);

		let resolvedPath = await resolveQueryFilePath(path.join('${env:TEST_PATH}', 'test.sql'), contextService, configurationResolverService);
		equal(resolvedPath, queryFilePath);
	});

	test('resolveQueryFilePath throws if invalid param var specified', async (done) => {
		let invalidPath = path.join('${INVALID}', 'test.sql');
		let configurationResolverService = new ConfigurationResolverService(
			new TestWindowService({}),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined);

		try {
			await resolveQueryFilePath(invalidPath, new TestContextService(), configurationResolverService);
		}
		catch (e) {
			done();
		}

	});

	suiteTeardown(() => {
		// Clean up our test files
		return pfs.rimraf(testRootPath);
	});
});

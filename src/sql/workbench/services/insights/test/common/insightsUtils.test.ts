/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { equal, fail } from 'assert';
import * as os from 'os';

import { resolveQueryFilePath } from 'sql/workbench/services/insights/common/insightsUtils';

import * as path from 'vs/base/common/path';
import * as pfs from 'vs/base/node/pfs';

import { getRandomTestPath } from 'vs/base/test/node/testUtils';
import { Workspace, toWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { ConfigurationResolverService } from 'vs/workbench/services/configurationResolver/browser/configurationResolverService';
import { TestContextService } from 'vs/workbench/test/workbenchTestServices';
import { IExtensionHostDebugParams, IDebugParams, ParsedArgs } from 'vs/platform/environment/common/environment';
import { URI } from 'vs/base/common/uri';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IWindowConfiguration } from 'vs/platform/windows/common/windows';

class TestEnvironmentService implements IWorkbenchEnvironmentService {
	machineSettingsHome: string;
	machineSettingsPath: string;
	extensionDevelopmentLocationURI?: URI[];

	constructor(private userEnv: { [key: string]: any }) {

	}

	get configuration(): IWindowConfiguration {
		return {
			userEnv: this.userEnv
		} as IWindowConfiguration;
	}

	_serviceBrand: any;
	args: ParsedArgs;
	execPath: string;
	cliPath: string;
	appRoot: string;
	userHome: string;
	userDataPath: string;
	appNameLong: string;
	appQuality?: string;
	appSettingsHome: URI;

	settingsResource: URI;
	appKeybindingsPath: string;
	settingsSearchBuildId?: number;
	settingsSearchUrl?: string;
	globalStorageHome: string;
	workspaceStorageHome: string;
	backupHome: string;
	backupWorkspacesPath: string;
	untitledWorkspacesHome: URI;
	isExtensionDevelopment: boolean;
	disableExtensions: boolean | string[];
	builtinExtensionsPath: string;
	extensionsPath: string;
	extensionTestsLocationURI?: URI;
	debugExtensionHost: IExtensionHostDebugParams;
	debugSearch: IDebugParams;
	logExtensionHostCommunication: boolean;
	isBuilt: boolean;
	wait: boolean;
	status: boolean;
	log?: string;
	logsPath: string;
	verbose: boolean;
	skipGettingStarted: boolean;
	skipReleaseNotes: boolean;
	skipAddToRecentlyOpened: boolean;
	mainIPCHandle: string;
	sharedIPCHandle: string;
	nodeCachedDataDir?: string;
	installSourcePath: string;
	disableUpdates: boolean;
	disableCrashReporter: boolean;
	driverHandle?: string;
	driverVerbose: boolean;
}

suite('Insights Utils tests', function () {
	let testRootPath: string;
	let queryFileDir: string;
	let queryFilePath: string;

	suiteSetup(async () => {
		// Create test file - just needs to exist for verifying the path resolution worked correctly
		testRootPath = path.join(os.tmpdir(), 'adstests');
		queryFileDir = getRandomTestPath(testRootPath, 'insightsutils');
		await pfs.mkdirp(queryFileDir);
		queryFilePath = path.join(queryFileDir, 'test.sql');
		await pfs.writeFile(queryFilePath, '');
	});

	test('resolveQueryFilePath resolves path correctly with fully qualified path', async () => {
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			new TestEnvironmentService({}),
			undefined,
			undefined,
			new TestContextService(),
			undefined);

		const resolvedPath = await resolveQueryFilePath(queryFilePath, new TestContextService(), configurationResolverService);
		equal(resolvedPath, queryFilePath);
	});

	test('resolveQueryFilePath resolves path correctly with workspaceRoot var and non-empty workspace containing file', async () => {
		// Create mock context service with our test folder added as a workspace folder for resolution
		const contextService = new TestContextService(
			new Workspace(
				'TestWorkspace',
				[toWorkspaceFolder(URI.file(queryFileDir))]
			));
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			new TestEnvironmentService({}),
			undefined,
			undefined,
			contextService,
			undefined);

		const resolvedPath = await resolveQueryFilePath(path.join('${workspaceRoot}', 'test.sql'), contextService, configurationResolverService);
		equal(resolvedPath, queryFilePath);
	});

	test('resolveQueryFilePath throws with workspaceRoot var and non-empty workspace not containing file', async (done) => {
		const tokenizedPath = path.join('${workspaceRoot}', 'test.sql');
		// Create mock context service with a folder NOT containing our test file to verify it returns original path
		const contextService = new TestContextService(
			new Workspace(
				'TestWorkspace',
				[toWorkspaceFolder(URI.file(os.tmpdir()))])
		);
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			new TestEnvironmentService({}),
			undefined,
			undefined,
			contextService,
			undefined);

		try {
			await resolveQueryFilePath(tokenizedPath, contextService, configurationResolverService);
			fail('Should have thrown');
		}
		catch (e) {
			done();
		}
	});

	test('resolveQueryFilePath throws with workspaceRoot var and empty workspace', async (done) => {
		const tokenizedPath = path.join('${workspaceRoot}', 'test.sql');
		// Create mock context service with an empty workspace
		const contextService = new TestContextService(
			new Workspace(
				'TestWorkspace'));
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			new TestEnvironmentService({}),
			undefined,
			undefined,
			contextService,
			undefined);

		try {
			await resolveQueryFilePath(tokenizedPath, contextService, configurationResolverService);
			fail('Should have thrown');
		}
		catch (e) {
			done();
		}
	});

	test('resolveQueryFilePath resolves path correctly with env var and empty workspace', async () => {
		const contextService = new TestContextService(
			new Workspace('TestWorkspace'));

		// Create mock window service with env variable containing test folder for resolution
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			new TestEnvironmentService({ TEST_PATH: queryFileDir }),
			undefined,
			undefined,
			undefined,
			undefined);

		const resolvedPath = await resolveQueryFilePath(path.join('${env:TEST_PATH}', 'test.sql'), contextService, configurationResolverService);
		equal(resolvedPath, queryFilePath);
	});

	test('resolveQueryFilePath resolves path correctly with env var and non-empty workspace', async () => {
		const contextService = new TestContextService(
			new Workspace('TestWorkspace', [toWorkspaceFolder(URI.file(os.tmpdir()))]));

		// Create mock window service with env variable containing test folder for resolution
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			new TestEnvironmentService({ TEST_PATH: queryFileDir }),
			undefined,
			undefined,
			undefined,
			undefined);

		const resolvedPath = await resolveQueryFilePath(path.join('${env:TEST_PATH}', 'test.sql'), contextService, configurationResolverService);
		equal(resolvedPath, queryFilePath);
	});

	test('resolveQueryFilePath throws if invalid param var specified', async (done) => {
		const invalidPath = path.join('${INVALID}', 'test.sql');
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			new TestEnvironmentService({}),
			undefined,
			undefined,
			undefined,
			undefined);

		try {
			await resolveQueryFilePath(invalidPath, new TestContextService(), configurationResolverService);
			fail('Should have thrown');
		} catch (e) {
			done();
		}

	});

	suiteTeardown(() => {
		// Clean up our test files
		return pfs.rimraf(testRootPath, pfs.RimRafMode.MOVE);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { equal, fail } from 'assert';
import * as os from 'os';

import { resolveQueryFilePath } from 'sql/workbench/services/insights/common/insightsUtils';

import * as path from 'vs/base/common/path';

import { Workspace, toWorkspaceFolder, IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { ConfigurationResolverService } from 'vs/workbench/services/configurationResolver/browser/configurationResolverService';
import { TestContextService, TestFileService } from 'vs/workbench/test/workbenchTestServices';
import { IExtensionHostDebugParams, IDebugParams, ParsedArgs } from 'vs/platform/environment/common/environment';
import { URI } from 'vs/base/common/uri';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IWindowConfiguration } from 'vs/platform/windows/common/windows';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';
import { IFileService } from 'vs/platform/files/common/files';
import * as pfs from 'vs/base/node/pfs';
import { getRandomTestPath } from 'vs/base/test/node/testUtils';
import { IWorkbenchConstructionOptions } from 'vs/workbench/workbench.web.api';

class TestEnvironmentService implements IWorkbenchEnvironmentService {
	logFile: URI;
	options?: IWorkbenchConstructionOptions;
	galleryMachineIdResource?: URI;
	webviewCspSource: string;
	webviewCspRule: string;
	localeResource: URI;
	userRoamingDataHome: URI;
	webviewEndpoint?: string;
	webviewResourceRoot: string;
	keyboardLayoutResource: URI;
	machineSettingsResource: URI;
	keybindingsResource: URI;
	machineSettingsHome: URI;
	machineSettingsPath: string;
	extensionDevelopmentLocationURI?: URI[];

	constructor(private userEnv: { [key: string]: any }) {

	}

	get configuration(): IWindowConfiguration {
		return {
			userEnv: this.userEnv
		} as IWindowConfiguration;
	}

	_serviceBrand: undefined;
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
	backupHome: URI;
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

		const fileService = new class extends TestFileService {
			exists(uri: URI): Promise<boolean> {
				return pfs.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();

		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, new TestContextService());
		instantiationService.set(IFileService, fileService);

		const resolvedPath = await instantiationService.invokeFunction(resolveQueryFilePath, queryFilePath);
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

		const fileService = new class extends TestFileService {
			exists(uri: URI): Promise<boolean> {
				return pfs.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();
		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, contextService);
		instantiationService.set(IFileService, fileService);

		const resolvedPath = await instantiationService.invokeFunction(resolveQueryFilePath, path.join('${workspaceRoot}', 'test.sql'));
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

		const fileService = new class extends TestFileService {
			exists(uri: URI): Promise<boolean> {
				return pfs.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();
		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, contextService);
		instantiationService.set(IFileService, fileService);

		try {
			await instantiationService.invokeFunction(resolveQueryFilePath, tokenizedPath);
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

		const fileService = new class extends TestFileService {
			exists(uri: URI): Promise<boolean> {
				return pfs.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();
		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, contextService);
		instantiationService.set(IFileService, fileService);

		try {
			await instantiationService.invokeFunction(resolveQueryFilePath, tokenizedPath);
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

		const fileService = new class extends TestFileService {
			exists(uri: URI): Promise<boolean> {
				return pfs.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();
		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, contextService);
		instantiationService.set(IFileService, fileService);

		const resolvedPath = await instantiationService.invokeFunction(resolveQueryFilePath, path.join('${env:TEST_PATH}', 'test.sql'));
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

		const fileService = new class extends TestFileService {
			exists(uri: URI): Promise<boolean> {
				return pfs.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();
		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, contextService);
		instantiationService.set(IFileService, fileService);

		const resolvedPath = await instantiationService.invokeFunction(resolveQueryFilePath, path.join('${env:TEST_PATH}', 'test.sql'));
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

		const fileService = new class extends TestFileService {
			exists(uri: URI): Promise<boolean> {
				return pfs.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();
		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, new TestContextService());
		instantiationService.set(IFileService, fileService);

		try {
			await instantiationService.invokeFunction(resolveQueryFilePath, invalidPath);
			fail('Should have thrown');
		} catch (e) {
			done();
		}

	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ok, fail } from 'assert';
import * as os from 'os';

import { resolveQueryFilePath } from 'sql/workbench/services/insights/common/insightsUtils';

import * as path from 'vs/base/common/path';
import * as fs from 'fs';

import { Workspace, toWorkspaceFolder, IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { ConfigurationResolverService, BaseConfigurationResolverService } from 'vs/workbench/services/configurationResolver/browser/configurationResolverService';
import { TestFileService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestContextService } from 'vs/workbench/test/common/workbenchTestServices';
import { URI } from 'vs/base/common/uri';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';
import { IFileService } from 'vs/platform/files/common/files';
import * as pfs from 'vs/base/node/pfs';
import { getRandomTestPath } from 'vs/base/test/node/testUtils';
import { IProcessEnvironment } from 'vs/base/common/platform';
import { NativeWorkbenchEnvironmentService } from 'vs/workbench/services/environment/electron-sandbox/environmentService';
import { isEqual } from 'vs/base/common/resources';
import { TestWorkbenchConfiguration } from 'vs/workbench/test/electron-browser/workbenchTestServices';

class MockWorkbenchEnvironmentService extends NativeWorkbenchEnvironmentService {

	constructor(public userEnv: IProcessEnvironment) {
		super({ ...TestWorkbenchConfiguration, userEnv }, undefined);
	}
}

class TestConfigurationResolverService extends BaseConfigurationResolverService {

}

suite('Insights Utils tests', function () {
	let testRootPath: string;
	let queryFileDir: string;
	let queryFilePath: string;

	suiteSetup(async () => {
		// Create test file - just needs to exist for verifying the path resolution worked correctly
		testRootPath = path.join(os.tmpdir(), 'adstests');
		queryFileDir = getRandomTestPath(testRootPath, 'insightsutils');

		await fs.promises.mkdir(queryFileDir, { recursive: true });

		queryFilePath = path.join(queryFileDir, 'test.sql');
		await pfs.Promises.writeFile(queryFilePath, '');
	});

	test('resolveQueryFilePath resolves path correctly with fully qualified path', async () => {
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			undefined,
			undefined,
			new TestContextService(),
			undefined,
			undefined,
			undefined);

		const fileService = new class extends TestFileService {
			override exists(uri: URI): Promise<boolean> {
				return pfs.Promises.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();

		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, new TestContextService());
		instantiationService.set(IFileService, fileService);

		const resolvedPath = await instantiationService.invokeFunction(resolveQueryFilePath, queryFilePath);
		ok(isEqual(resolvedPath, URI.file(queryFilePath)));
	});

	test('resolveQueryFilePath resolves path correctly with workspaceRoot var and non-empty workspace containing file', async () => {
		// Create mock context service with our test folder added as a workspace folder for resolution
		const contextService = new TestContextService(
			new Workspace(
				'TestWorkspace',
				[toWorkspaceFolder(URI.file(queryFileDir))],
				undefined, undefined
			));
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			undefined,
			undefined,
			contextService,
			undefined,
			undefined,
			undefined);

		const fileService = new class extends TestFileService {
			override exists(uri: URI): Promise<boolean> {
				return pfs.Promises.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();
		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, contextService);
		instantiationService.set(IFileService, fileService);

		const resolvedPath = await instantiationService.invokeFunction(resolveQueryFilePath, path.join('${workspaceRoot}', 'test.sql'));
		ok(isEqual(resolvedPath, URI.file(queryFilePath)));
	});

	test('resolveQueryFilePath throws with workspaceRoot var and non-empty workspace not containing file', async () => {
		const tokenizedPath = path.join('${workspaceRoot}', 'test.sql');
		// Create mock context service with a folder NOT containing our test file to verify it returns original path
		const contextService = new TestContextService(
			new Workspace(
				'TestWorkspace',
				[toWorkspaceFolder(URI.file(os.tmpdir()))],
				undefined, undefined)
		);
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			undefined,
			undefined,
			contextService,
			undefined,
			undefined,
			undefined);

		const fileService = new class extends TestFileService {
			override exists(uri: URI): Promise<boolean> {
				return pfs.Promises.exists(uri.fsPath);
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
		}
	});

	test.skip('resolveQueryFilePath throws with workspaceRoot var and empty workspace', async () => {
		const tokenizedPath = path.join('${workspaceRoot}', 'test.sql');
		// Create mock context service with an empty workspace
		const contextService = new TestContextService(
			new Workspace(
				'TestWorkspace',
				undefined, undefined, undefined));
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			undefined,
			undefined,
			contextService,
			undefined,
			undefined,
			undefined);

		const fileService = new class extends TestFileService {
			override exists(uri: URI): Promise<boolean> {
				return pfs.Promises.exists(uri.fsPath);
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
		}
	});

	test.skip('resolveQueryFilePath resolves path correctly with env var and empty workspace', async () => {
		const contextService = new TestContextService(
			new Workspace('TestWorkspace',
				undefined, undefined, undefined));

		const environmentService = new MockWorkbenchEnvironmentService({ TEST_PATH: queryFileDir });

		// Create mock window service with env variable containing test folder for resolution
		const configurationResolverService = new TestConfigurationResolverService({ getAppRoot: () => undefined, getExecPath: () => undefined }, Promise.resolve(environmentService.userEnv),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined);

		const fileService = new class extends TestFileService {
			override exists(uri: URI): Promise<boolean> {
				return pfs.Promises.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();
		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, contextService);
		instantiationService.set(IFileService, fileService);

		const resolvedPath = await instantiationService.invokeFunction(resolveQueryFilePath, path.join('${env:TEST_PATH}', 'test.sql'));
		ok(isEqual(resolvedPath, URI.file(queryFilePath)));
	});

	test('resolveQueryFilePath resolves path correctly with env var and non-empty workspace', async () => {
		const contextService = new TestContextService(
			new Workspace('TestWorkspace', [toWorkspaceFolder(URI.file(os.tmpdir()))], undefined, undefined));

		const environmentService = new MockWorkbenchEnvironmentService({ TEST_PATH: queryFileDir });

		// Create mock window service with env variable containing test folder for resolution
		const configurationResolverService = new TestConfigurationResolverService({ getAppRoot: () => undefined, getExecPath: () => undefined }, Promise.resolve(environmentService.userEnv),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined);

		const fileService = new class extends TestFileService {
			override exists(uri: URI): Promise<boolean> {
				return pfs.Promises.exists(uri.fsPath);
			}
		};

		const instantiationService = new TestInstantiationService();
		instantiationService.set(IConfigurationResolverService, configurationResolverService);
		instantiationService.set(IWorkspaceContextService, contextService);
		instantiationService.set(IFileService, fileService);

		const resolvedPath = await instantiationService.invokeFunction(resolveQueryFilePath, path.join('${env:TEST_PATH}', 'test.sql'));
		ok(isEqual(resolvedPath, URI.file(queryFilePath)));
	});

	test('resolveQueryFilePath throws if invalid param var specified', async () => {
		const invalidPath = path.join('${INVALID}', 'test.sql');
		const configurationResolverService = new ConfigurationResolverService(
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined);

		const fileService = new class extends TestFileService {
			override exists(uri: URI): Promise<boolean> {
				return pfs.Promises.exists(uri.fsPath);
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
		}

	});
});

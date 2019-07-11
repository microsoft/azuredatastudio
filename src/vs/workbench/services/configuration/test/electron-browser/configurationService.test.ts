/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'vs/base/common/path';
import * as os from 'os';
import { URI } from 'vs/base/common/uri';
import { Registry } from 'vs/platform/registry/common/platform';
import { ParsedArgs, IEnvironmentService } from 'vs/platform/environment/common/environment';
import { parseArgs } from 'vs/platform/environment/node/argv';
import * as pfs from 'vs/base/node/pfs';
import * as uuid from 'vs/base/common/uuid';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { WorkspaceService } from 'vs/workbench/services/configuration/browser/configurationService';
import { ISingleFolderWorkspaceInitializationPayload, IWorkspaceIdentifier } from 'vs/platform/workspaces/common/workspaces';
import { ConfigurationEditingErrorCode } from 'vs/workbench/services/configuration/common/configurationEditingService';
import { IFileService } from 'vs/platform/files/common/files';
import { IWorkspaceContextService, WorkbenchState, IWorkspaceFoldersChangeEvent } from 'vs/platform/workspace/common/workspace';
import { ConfigurationTarget, IConfigurationService, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';
import { workbenchInstantiationService, TestTextFileService, RemoteFileSystemProvider } from 'vs/workbench/test/workbenchTestServices';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { TextModelResolverService } from 'vs/workbench/services/textmodelResolver/common/textModelResolverService';
import { IJSONEditingService } from 'vs/workbench/services/configuration/common/jsonEditing';
import { JSONEditingService } from 'vs/workbench/services/configuration/common/jsonEditingService';
import { createHash } from 'crypto';
import { Schemas } from 'vs/base/common/network';
import { originalFSPath, dirname } from 'vs/base/common/resources';
import { isLinux } from 'vs/base/common/platform';
import { IWindowConfiguration } from 'vs/platform/windows/common/windows';
import { RemoteAgentService } from 'vs/workbench/services/remote/electron-browser/remoteAgentServiceImpl';
import { RemoteAuthorityResolverService } from 'vs/platform/remote/electron-browser/remoteAuthorityResolverService';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { FileService } from 'vs/workbench/services/files/common/fileService';
import { NullLogService } from 'vs/platform/log/common/log';
import { DiskFileSystemProvider } from 'vs/workbench/services/files/node/diskFileSystemProvider';
import { ConfigurationCache } from 'vs/workbench/services/configuration/node/configurationCache';
import { IRemoteAgentEnvironment } from 'vs/platform/remote/common/remoteAgentEnvironment';
import { IConfigurationCache } from 'vs/workbench/services/configuration/common/configuration';
import { VSBuffer } from 'vs/base/common/buffer';
import { SignService } from 'vs/platform/sign/browser/signService';
import { FileUserDataProvider } from 'vs/workbench/services/userData/common/fileUserDataProvider';
import { IKeybindingEditingService, KeybindingsEditingService } from 'vs/workbench/services/keybinding/common/keybindingEditing';
import { WorkbenchEnvironmentService } from 'vs/workbench/services/environment/node/environmentService';
import { UserDataFileSystemProvider } from 'vs/workbench/services/userData/common/userDataFileSystemProvider';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';

class SettingsTestEnvironmentService extends WorkbenchEnvironmentService {

	constructor(args: ParsedArgs, _execPath: string, private _settingsPath: string) {
		super(<IWindowConfiguration>args, _execPath);
	}

	get appSettingsHome(): URI { return dirname(URI.file(this._settingsPath)); }
}

function setUpFolderWorkspace(folderName: string): Promise<{ parentDir: string, folderDir: string }> {
	const id = uuid.generateUuid();
	const parentDir = path.join(os.tmpdir(), 'vsctests', id);
	return setUpFolder(folderName, parentDir).then(folderDir => ({ parentDir, folderDir }));
}

function setUpFolder(folderName: string, parentDir: string): Promise<string> {
	const folderDir = path.join(parentDir, folderName);
	// {{SQL CARBON EDIT}}
	const workspaceSettingsDir = path.join(folderDir, '.azuredatastudio');
	return Promise.resolve(pfs.mkdirp(workspaceSettingsDir, 493).then(() => folderDir));
}

function convertToWorkspacePayload(folder: URI): ISingleFolderWorkspaceInitializationPayload {
	return {
		id: createHash('md5').update(folder.fsPath).digest('hex'),
		folder
	} as ISingleFolderWorkspaceInitializationPayload;
}

function setUpWorkspace(folders: string[]): Promise<{ parentDir: string, configPath: URI }> {

	const id = uuid.generateUuid();
	const parentDir = path.join(os.tmpdir(), 'vsctests', id);

	return Promise.resolve(pfs.mkdirp(parentDir, 493)
		.then(() => {
			const configPath = path.join(parentDir, 'vsctests.code-workspace');
			const workspace = { folders: folders.map(path => ({ path })) };
			fs.writeFileSync(configPath, JSON.stringify(workspace, null, '\t'));

			return Promise.all(folders.map(folder => setUpFolder(folder, parentDir)))
				.then(() => ({ parentDir, configPath: URI.file(configPath) }));
		}));

}


suite('WorkspaceContextService - Folder', () => {
	setup(() => {
		// {{SQL CARBON EDIT}} - Remove tests
	});

	teardown(() => {
		// {{SQL CARBON EDIT}} - Remove tests
	});

	test('getWorkspace()', () => {
		// {{SQL CARBON EDIT}} - Remove tests
		assert.equal(0, 0);
	});

	test('configuration of newly added folder is available on configuration change event', async () => {
		// {{SQL CARBON EDIT}} - Remove tests
		assert.equal(0, 0);
	});
});

suite('WorkspaceConfigurationService - Remote Folder', () => {

	let workspaceName = `testWorkspace${uuid.generateUuid()}`, parentResource: string, workspaceDir: string, testObject: WorkspaceService, globalSettingsFile: string, remoteSettingsFile: string, instantiationService: TestInstantiationService, resolveRemoteEnvironment: () => void;
	const remoteAuthority = 'configuraiton-tests';
	const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
	const diskFileSystemProvider = new DiskFileSystemProvider(new NullLogService());

	suiteSetup(() => {
		configurationRegistry.registerConfiguration({
			'id': '_test',
			'type': 'object',
			'properties': {
				'configurationService.remote.applicationSetting': {
					'type': 'string',
					'default': 'isSet',
					scope: ConfigurationScope.APPLICATION
				},
				'configurationService.remote.machineSetting': {
					'type': 'string',
					'default': 'isSet',
					scope: ConfigurationScope.MACHINE
				},
				'configurationService.remote.testSetting': {
					'type': 'string',
					'default': 'isSet',
					scope: ConfigurationScope.RESOURCE
				}
			}
		});
	});

	setup(() => {
		return setUpFolderWorkspace(workspaceName)
			.then(({ parentDir, folderDir }) => {

				parentResource = parentDir;
				workspaceDir = folderDir;
				globalSettingsFile = path.join(parentDir, 'settings.json');
				remoteSettingsFile = path.join(parentDir, 'remote-settings.json');

				instantiationService = <TestInstantiationService>workbenchInstantiationService();
				const environmentService = new SettingsTestEnvironmentService(parseArgs(process.argv), process.execPath, globalSettingsFile);
				const remoteEnvironmentPromise = new Promise<Partial<IRemoteAgentEnvironment>>(c => resolveRemoteEnvironment = () => c({ settingsPath: URI.file(remoteSettingsFile).with({ scheme: Schemas.vscodeRemote, authority: remoteAuthority }) }));
				const remoteAgentService = instantiationService.stub(IRemoteAgentService, <Partial<IRemoteAgentService>>{ getEnvironment: () => remoteEnvironmentPromise });
				const fileService = new FileService(new NullLogService());
				fileService.registerProvider(Schemas.file, diskFileSystemProvider);
				fileService.registerProvider(Schemas.userData, new UserDataFileSystemProvider(environmentService.appSettingsHome.with({ scheme: Schemas.userData }), new FileUserDataProvider(environmentService.appSettingsHome, fileService)));
				const configurationCache: IConfigurationCache = { read: () => Promise.resolve(''), write: () => Promise.resolve(), remove: () => Promise.resolve() };
				testObject = new WorkspaceService({ configurationCache, remoteAuthority }, environmentService, fileService, remoteAgentService);
				instantiationService.stub(IWorkspaceContextService, testObject);
				instantiationService.stub(IConfigurationService, testObject);
				instantiationService.stub(IEnvironmentService, environmentService);
				instantiationService.stub(IFileService, fileService);
			});
	});

	async function initialize(): Promise<void> {
		await testObject.initialize(convertToWorkspacePayload(URI.file(workspaceDir)));
		instantiationService.stub(ITextFileService, instantiationService.createInstance(TestTextFileService));
		instantiationService.stub(ITextModelService, <ITextModelService>instantiationService.createInstance(TextModelResolverService));
		testObject.acquireInstantiationService(instantiationService);
	}

	function registerRemoteFileSystemProvider(): void {
		instantiationService.get(IFileService).registerProvider(Schemas.vscodeRemote, new RemoteFileSystemProvider(diskFileSystemProvider, remoteAuthority));
	}

	function registerRemoteFileSystemProviderOnActivation(): void {
		const disposable = instantiationService.get(IFileService).onWillActivateFileSystemProvider(e => {
			if (e.scheme === Schemas.vscodeRemote) {
				disposable.dispose();
				e.join(Promise.resolve().then(() => registerRemoteFileSystemProvider()));
			}
		});
	}

	teardown(() => {
		if (testObject) {
			(<WorkspaceService>testObject).dispose();
		}
		if (parentResource) {
			return pfs.rimraf(parentResource, pfs.RimRafMode.MOVE);
		}
		return undefined;
	});

	test('remote settings override globals', async () => {
		fs.writeFileSync(remoteSettingsFile, '{ "configurationService.remote.machineSetting": "remoteValue" }');
		registerRemoteFileSystemProvider();
		resolveRemoteEnvironment();
		await initialize();
		assert.equal(testObject.getValue('configurationService.remote.machineSetting'), 'remoteValue');
	});

	test('remote settings override globals after remote provider is registered on activation', async () => {
		fs.writeFileSync(remoteSettingsFile, '{ "configurationService.remote.machineSetting": "remoteValue" }');
		resolveRemoteEnvironment();
		registerRemoteFileSystemProviderOnActivation();
		await initialize();
		assert.equal(testObject.getValue('configurationService.remote.machineSetting'), 'remoteValue');
	});

	test('remote settings override globals after remote environment is resolved', async () => {
		fs.writeFileSync(remoteSettingsFile, '{ "configurationService.remote.machineSetting": "remoteValue" }');
		registerRemoteFileSystemProvider();
		await initialize();
		const promise = new Promise((c, e) => {
			testObject.onDidChangeConfiguration(event => {
				try {
					assert.equal(event.source, ConfigurationTarget.USER);
					assert.deepEqual(event.affectedKeys, ['configurationService.remote.machineSetting']);
					assert.equal(testObject.getValue('configurationService.remote.machineSetting'), 'remoteValue');
					c();
				} catch (error) {
					e(error);
				}
			});
		});
		resolveRemoteEnvironment();
		return promise;
	});

	test('remote settings override globals after remote provider is registered on activation and remote environment is resolved', async () => {
		fs.writeFileSync(remoteSettingsFile, '{ "configurationService.remote.machineSetting": "remoteValue" }');
		registerRemoteFileSystemProviderOnActivation();
		await initialize();
		const promise = new Promise((c, e) => {
			testObject.onDidChangeConfiguration(event => {
				try {
					assert.equal(event.source, ConfigurationTarget.USER);
					assert.deepEqual(event.affectedKeys, ['configurationService.remote.machineSetting']);
					assert.equal(testObject.getValue('configurationService.remote.machineSetting'), 'remoteValue');
					c();
				} catch (error) {
					e(error);
				}
			});
		});
		resolveRemoteEnvironment();
		return promise;
	});

	test('update remote settings', async () => {
		registerRemoteFileSystemProvider();
		resolveRemoteEnvironment();
		await initialize();
		assert.equal(testObject.getValue('configurationService.remote.machineSetting'), 'isSet');
		const promise = new Promise((c, e) => {
			testObject.onDidChangeConfiguration(event => {
				try {
					assert.equal(event.source, ConfigurationTarget.USER);
					assert.deepEqual(event.affectedKeys, ['configurationService.remote.machineSetting']);
					assert.equal(testObject.getValue('configurationService.remote.machineSetting'), 'remoteValue');
					c();
				} catch (error) {
					e(error);
				}
			});
		});
		await instantiationService.get(IFileService).writeFile(URI.file(remoteSettingsFile), VSBuffer.fromString('{ "configurationService.remote.machineSetting": "remoteValue" }'));
		return promise;
	});

	test('machine settings in local user settings does not override defaults', async () => {
		fs.writeFileSync(globalSettingsFile, '{ "configurationService.remote.machineSetting": "globalValue" }');
		registerRemoteFileSystemProvider();
		resolveRemoteEnvironment();
		await initialize();
		assert.equal(testObject.getValue('configurationService.remote.machineSetting'), 'isSet');
	});

});

function getWorkspaceId(configPath: URI): string {
	let workspaceConfigPath = configPath.scheme === Schemas.file ? originalFSPath(configPath) : configPath.toString();
	if (!isLinux) {
		workspaceConfigPath = workspaceConfigPath.toLowerCase(); // sanitize for platform file system
	}

	return createHash('md5').update(workspaceConfigPath).digest('hex');
}

export function getWorkspaceIdentifier(configPath: URI): IWorkspaceIdentifier {
	return {
		configPath,
		id: getWorkspaceId(configPath)
	};
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IUserDataSyncStoreService, IUserDataSyncService, SyncResource, UserDataSyncError, UserDataSyncErrorCode, ISyncData } from 'vs/platform/userDataSync/common/userDataSync';
import { UserDataSyncClient, UserDataSyncTestServer } from 'vs/platform/userDataSync/test/common/userDataSyncClient';
import { DisposableStore, toDisposable } from 'vs/base/common/lifecycle';
import { SettingsSynchroniser, ISettingsSyncContent } from 'vs/platform/userDataSync/common/settingsSync';
import { UserDataSyncService } from 'vs/platform/userDataSync/common/userDataSyncService';
import { IFileService } from 'vs/platform/files/common/files';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { VSBuffer } from 'vs/base/common/buffer';
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { Event } from 'vs/base/common/event';

suite('SettingsSync', () => {

	const disposableStore = new DisposableStore();
	const server = new UserDataSyncTestServer();
	let client: UserDataSyncClient;

	let testObject: SettingsSynchroniser;

	suiteSetup(() => {
		Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
			'id': 'settingsSync',
			'type': 'object',
			'properties': {
				'settingsSync.machine': {
					'type': 'string',
					'scope': ConfigurationScope.MACHINE
				},
				'settingsSync.machineOverridable': {
					'type': 'string',
					'scope': ConfigurationScope.MACHINE_OVERRIDABLE
				}
			}
		});
	});

	setup(async () => {
		client = disposableStore.add(new UserDataSyncClient(server));
		await client.setUp(true);
		testObject = (client.instantiationService.get(IUserDataSyncService) as UserDataSyncService).getSynchroniser(SyncResource.Settings) as SettingsSynchroniser;
		disposableStore.add(toDisposable(() => client.instantiationService.get(IUserDataSyncStoreService).clear()));
	});

	teardown(() => disposableStore.clear());

	test('when settings file does not exist', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const settingResource = client.instantiationService.get(IEnvironmentService).settingsResource;

		assert.deepEqual(await testObject.getLastSyncUserData(), null);
		let manifest = await client.manifest();
		server.reset();
		await testObject.sync(manifest);

		assert.deepEqual(server.requests, [
			{ type: 'GET', url: `${server.url}/v1/resource/${testObject.resource}/latest`, headers: {} },
		]);
		assert.ok(!await fileService.exists(settingResource));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.deepEqual(lastSyncUserData!.ref, remoteUserData.ref);
		assert.deepEqual(lastSyncUserData!.syncData, remoteUserData.syncData);
		assert.equal(lastSyncUserData!.syncData, null);

		manifest = await client.manifest();
		server.reset();
		await testObject.sync(manifest);
		assert.deepEqual(server.requests, []);

		manifest = await client.manifest();
		server.reset();
		await testObject.sync(manifest);
		assert.deepEqual(server.requests, []);
	});

	test('when settings file is created after first sync', async () => {
		const fileService = client.instantiationService.get(IFileService);

		const settingsResource = client.instantiationService.get(IEnvironmentService).settingsResource;
		await testObject.sync(await client.manifest());
		await fileService.createFile(settingsResource, VSBuffer.fromString('{}'));

		let lastSyncUserData = await testObject.getLastSyncUserData();
		const manifest = await client.manifest();
		server.reset();
		await testObject.sync(manifest);

		assert.deepEqual(server.requests, [
			{ type: 'POST', url: `${server.url}/v1/resource/${testObject.resource}`, headers: { 'If-Match': lastSyncUserData?.ref } },
		]);

		lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.deepEqual(lastSyncUserData!.ref, remoteUserData.ref);
		assert.deepEqual(lastSyncUserData!.syncData, remoteUserData.syncData);
		assert.equal(testObject.parseSettingsSyncContent(lastSyncUserData!.syncData!.content!)?.settings, '{}');
	});

	test('sync for first time to the server', async () => {
		const expected =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"workbench.tree.indent": 20,
	"workbench.colorCustomizations": {
		"editorLineNumber.activeForeground": "#ff0000",
		"[GitHub Sharp]": {
			"statusBarItem.remoteBackground": "#24292E",
			"editorPane.background": "#f3f1f11a"
		}
	},

	"gitBranch.base": "remote-repo/master",

	// Experimental
	"workbench.view.experimental.allowMovingToNewContainer": true,
}`;

		await updateSettings(expected);
		await testObject.sync(await client.manifest());

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content!);
		assert.deepEqual(actual, expected);
	});

	test('do not sync machine settings', async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Machine
	"settingsSync.machine": "someValue",
	"settingsSync.machineOverridable": "someValue"
}`;
		await updateSettings(settingsContent);

		await testObject.sync(await client.manifest());

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content!);
		assert.deepEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp"
}`);
	});

	test('do not sync machine settings when spread across file', async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"settingsSync.machine": "someValue",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Machine
	"settingsSync.machineOverridable": "someValue"
}`;
		await updateSettings(settingsContent);

		await testObject.sync(await client.manifest());

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content!);
		assert.deepEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp"
}`);
	});

	test('do not sync machine settings when spread across file - 2', async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"settingsSync.machine": "someValue",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Machine
	"settingsSync.machineOverridable": "someValue",
	"files.simpleDialog.enable": true,
}`;
		await updateSettings(settingsContent);

		await testObject.sync(await client.manifest());

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content!);
		assert.deepEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"files.simpleDialog.enable": true,
}`);
	});

	test('sync when all settings are machine settings', async () => {
		const settingsContent =
			`{
	// Machine
	"settingsSync.machine": "someValue",
	"settingsSync.machineOverridable": "someValue"
}`;
		await updateSettings(settingsContent);

		await testObject.sync(await client.manifest());

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content!);
		assert.deepEqual(actual, `{
}`);
	});

	test('sync when all settings are machine settings with trailing comma', async () => {
		const settingsContent =
			`{
	// Machine
	"settingsSync.machine": "someValue",
	"settingsSync.machineOverridable": "someValue",
}`;
		await updateSettings(settingsContent);

		await testObject.sync(await client.manifest());

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content!);
		assert.deepEqual(actual, `{
	,
}`);
	});

	test('local change event is triggered when settings are changed', async () => {
		const content =
			`{
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,
}`;

		await updateSettings(content);
		await testObject.sync(await client.manifest());

		const promise = Event.toPromise(testObject.onDidChangeLocal);
		await updateSettings(`{
	"files.autoSave": "off",
	"files.simpleDialog.enable": true,
}`);
		await promise;
	});

	test('do not sync ignored settings', async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Editor
	"editor.fontFamily": "Fira Code",

	// Terminal
	"terminal.integrated.shell.osx": "some path",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"sync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	]
}`;
		await updateSettings(settingsContent);

		await testObject.sync(await client.manifest());

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content!);
		assert.deepEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"sync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	]
}`);
	});

	test('do not sync ignored and machine settings', async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Editor
	"editor.fontFamily": "Fira Code",

	// Terminal
	"terminal.integrated.shell.osx": "some path",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"sync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	],

	// Machine
	"settingsSync.machine": "someValue",
}`;
		await updateSettings(settingsContent);

		await testObject.sync(await client.manifest());

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content!);
		assert.deepEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"sync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	],
}`);
	});

	test('sync throws invalid content error', async () => {
		const expected =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"workbench.tree.indent": 20,
	"workbench.colorCustomizations": {
		"editorLineNumber.activeForeground": "#ff0000",
		"[GitHub Sharp]": {
			"statusBarItem.remoteBackground": "#24292E",
			"editorPane.background": "#f3f1f11a"
		}
	}

	"gitBranch.base": "remote-repo/master",

	// Experimental
	"workbench.view.experimental.allowMovingToNewContainer": true,
}`;

		await updateSettings(expected);

		try {
			await testObject.sync(await client.manifest());
			assert.fail('should fail with invalid content error');
		} catch (e) {
			assert.ok(e instanceof UserDataSyncError);
			assert.deepEqual((<UserDataSyncError>e).code, UserDataSyncErrorCode.LocalInvalidContent);
		}
	});

	function parseSettings(content: string): string {
		const syncData: ISyncData = JSON.parse(content);
		const settingsSyncContent: ISettingsSyncContent = JSON.parse(syncData.content);
		return settingsSyncContent.settings;
	}

	async function updateSettings(content: string): Promise<void> {
		await client.instantiationService.get(IFileService).writeFile(client.instantiationService.get(IEnvironmentService).settingsResource, VSBuffer.fromString(content));
	}


});

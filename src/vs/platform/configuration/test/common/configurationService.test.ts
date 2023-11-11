/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { VSBuffer } from 'vs/base/common/buffer';
import { Event } from 'vs/base/common/event';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { runWithFakedTimers } from 'vs/base/test/common/timeTravelScheduler';
import { ConfigurationTarget, isConfigured } from 'vs/platform/configuration/common/configuration';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { ConfigurationService } from 'vs/platform/configuration/common/configurationService';
import { IFileService } from 'vs/platform/files/common/files';
import { FileService } from 'vs/platform/files/common/fileService';
import { InMemoryFileSystemProvider } from 'vs/platform/files/common/inMemoryFilesystemProvider';
import { NullLogService } from 'vs/platform/log/common/log';
import { NullPolicyService } from 'vs/platform/policy/common/policy';
import { Registry } from 'vs/platform/registry/common/platform';

suite('ConfigurationService', () => {

	let fileService: IFileService;
	let settingsResource: URI;
	const disposables: DisposableStore = new DisposableStore();

	setup(async () => {
		fileService = disposables.add(new FileService(new NullLogService()));
		const diskFileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
		fileService.registerProvider(Schemas.file, diskFileSystemProvider);
		settingsResource = URI.file('settings.json');
	});

	teardown(() => disposables.clear());

	test('simple', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "bar" }'));
		const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
		await testObject.initialize();
		const config = testObject.getValue<{
			foo: string;
		}>();

		assert.ok(config);
		assert.strictEqual(config.foo, 'bar');
	}));

	test('config gets flattened', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "testworkbench.editor.tabs": true }'));

		const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
		await testObject.initialize();
		const config = testObject.getValue<{
			testworkbench: {
				editor: {
					tabs: boolean;
				};
			};
		}>();

		assert.ok(config);
		assert.ok(config.testworkbench);
		assert.ok(config.testworkbench.editor);
		assert.strictEqual(config.testworkbench.editor.tabs, true);
	}));

	test('error case does not explode', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		await fileService.writeFile(settingsResource, VSBuffer.fromString(',,,,'));

		const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
		await testObject.initialize();
		const config = testObject.getValue<{
			foo: string;
		}>();

		assert.ok(config);
	}));

	test('missing file does not explode', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const testObject = disposables.add(new ConfigurationService(URI.file('__testFile'), fileService, new NullPolicyService(), new NullLogService()));
		await testObject.initialize();

		const config = testObject.getValue<{ foo: string }>();

		assert.ok(config);
	}));

	test('trigger configuration change event when file does not exist', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
		await testObject.initialize();
		return new Promise<void>((c, e) => {
			disposables.add(Event.filter(testObject.onDidChangeConfiguration, e => e.source === ConfigurationTarget.USER)(() => {
				assert.strictEqual(testObject.getValue('foo'), 'bar');
				c();
			}));
			fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "bar" }')).catch(e);
		});

	}));

	test('trigger configuration change event when file exists', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
		await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "bar" }'));
		await testObject.initialize();

		return new Promise<void>((c) => {
			disposables.add(Event.filter(testObject.onDidChangeConfiguration, e => e.source === ConfigurationTarget.USER)(async (e) => {
				assert.strictEqual(testObject.getValue('foo'), 'barz');
				c();
			}));
			fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "barz" }'));
		});
	}));

	test('reloadConfiguration', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "bar" }'));

		const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
		await testObject.initialize();
		let config = testObject.getValue<{
			foo: string;
		}>();
		assert.ok(config);
		assert.strictEqual(config.foo, 'bar');
		await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "foo": "changed" }'));

		// force a reload to get latest
		await testObject.reloadConfiguration();
		config = testObject.getValue<{
			foo: string;
		}>();
		assert.ok(config);
		assert.strictEqual(config.foo, 'changed');
	}));

	test('model defaults', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		interface ITestSetting {
			configuration: {
				service: {
					testSetting: string;
				};
			};
		}

		const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
		configurationRegistry.registerConfiguration({
			'id': '_test',
			'type': 'object',
			'properties': {
				'configuration.service.testSetting': {
					'type': 'string',
					'default': 'isSet'
				}
			}
		});

		let testObject = disposables.add(new ConfigurationService(URI.file('__testFile'), fileService, new NullPolicyService(), new NullLogService()));
		await testObject.initialize();
		let setting = testObject.getValue<ITestSetting>();

		assert.ok(setting);
		assert.strictEqual(setting.configuration.service.testSetting, 'isSet');

		await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "testworkbench.editor.tabs": true }'));
		testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
		await testObject.initialize();

		setting = testObject.getValue<ITestSetting>();

		assert.ok(setting);
		assert.strictEqual(setting.configuration.service.testSetting, 'isSet');

		await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "configuration.service.testSetting": "isChanged" }'));

		await testObject.reloadConfiguration();
		setting = testObject.getValue<ITestSetting>();
		assert.ok(setting);
		assert.strictEqual(setting.configuration.service.testSetting, 'isChanged');
	}));

	test('lookup', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
		configurationRegistry.registerConfiguration({
			'id': '_test',
			'type': 'object',
			'properties': {
				'lookup.service.testSetting': {
					'type': 'string',
					'default': 'isSet'
				}
			}
		});

		const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
		await testObject.initialize();

		let res = testObject.inspect('something.missing');
		assert.strictEqual(res.value, undefined);
		assert.strictEqual(res.defaultValue, undefined);
		assert.strictEqual(res.userValue, undefined);
		assert.strictEqual(isConfigured(res), false);

		res = testObject.inspect('lookup.service.testSetting');
		assert.strictEqual(res.defaultValue, 'isSet');
		assert.strictEqual(res.value, 'isSet');
		assert.strictEqual(res.userValue, undefined);
		assert.strictEqual(isConfigured(res), false);

		await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "lookup.service.testSetting": "bar" }'));

		await testObject.reloadConfiguration();
		res = testObject.inspect('lookup.service.testSetting');
		assert.strictEqual(res.defaultValue, 'isSet');
		assert.strictEqual(res.userValue, 'bar');
		assert.strictEqual(res.value, 'bar');
		assert.strictEqual(isConfigured(res), true);

	}));

	test('lookup with null', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
		configurationRegistry.registerConfiguration({
			'id': '_testNull',
			'type': 'object',
			'properties': {
				'lookup.service.testNullSetting': {
					'type': 'null',
				}
			}
		});

		const testObject = disposables.add(new ConfigurationService(settingsResource, fileService, new NullPolicyService(), new NullLogService()));
		await testObject.initialize();

		let res = testObject.inspect('lookup.service.testNullSetting');
		assert.strictEqual(res.defaultValue, null);
		assert.strictEqual(res.value, null);
		assert.strictEqual(res.userValue, undefined);

		await fileService.writeFile(settingsResource, VSBuffer.fromString('{ "lookup.service.testNullSetting": null }'));

		await testObject.reloadConfiguration();

		res = testObject.inspect('lookup.service.testNullSetting');
		assert.strictEqual(res.defaultValue, null);
		assert.strictEqual(res.value, null);
		assert.strictEqual(res.userValue, null);
	}));
});

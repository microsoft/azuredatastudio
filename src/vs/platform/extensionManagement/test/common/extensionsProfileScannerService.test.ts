/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import { VSBuffer } from 'vs/base/common/buffer';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { joinPath } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { AbstractExtensionsProfileScannerService, ProfileExtensionsEvent } from 'vs/platform/extensionManagement/common/extensionsProfileScannerService';
import { ExtensionType, IExtension, IExtensionManifest, TargetPlatform } from 'vs/platform/extensions/common/extensions';
import { FileService } from 'vs/platform/files/common/fileService';
import { IFileService } from 'vs/platform/files/common/files';
import { InMemoryFileSystemProvider } from 'vs/platform/files/common/inMemoryFilesystemProvider';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { UriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentityService';
import { IUserDataProfilesService, UserDataProfilesService } from 'vs/platform/userDataProfile/common/userDataProfile';

class TestObject extends AbstractExtensionsProfileScannerService { }

suite('ExtensionsProfileScannerService', () => {

	const ROOT = URI.file('/ROOT');
	const disposables = new DisposableStore();

	const extensionsLocation = joinPath(ROOT, 'extensions');
	let instantiationService: TestInstantiationService;

	setup(async () => {
		instantiationService = disposables.add(new TestInstantiationService());
		const logService = new NullLogService();
		const fileService = disposables.add(new FileService(logService));
		const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
		fileService.registerProvider(ROOT.scheme, fileSystemProvider);
		instantiationService.stub(ILogService, logService);
		instantiationService.stub(IFileService, fileService);
		instantiationService.stub(ITelemetryService, NullTelemetryService);
		const uriIdentityService = instantiationService.stub(IUriIdentityService, new UriIdentityService(fileService));
		const environmentService = instantiationService.stub(IEnvironmentService, { userRoamingDataHome: ROOT, cacheHome: joinPath(ROOT, 'cache'), });
		const userDataProfilesService = new UserDataProfilesService(environmentService, fileService, uriIdentityService, logService);
		instantiationService.stub(IUserDataProfilesService, userDataProfilesService);
	});

	teardown(() => disposables.clear());

	suiteTeardown(() => sinon.restore());

	test('write extensions located in the same extensions folder', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined }]);
	});

	test('write extensions located in the different folder', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(ROOT, 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined }]);
	});

	test('write extensions located in the same extensions folder has relative location ', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);

		const actual = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(actual, [{ identifier: extension.identifier, location: extension.location.toJSON(), relativeLocation: 'pub.a-1.0.0', version: extension.manifest.version }]);
	});

	test('write extensions located in different extensions folder does not has relative location ', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(ROOT, 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);

		const actual = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(actual, [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version }]);
	});

	test('extension in old format is read and migrated', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: extension.location.toJSON(),
			version: extension.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined }]);

		const manifestContent = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(manifestContent, [{ identifier: extension.identifier, location: extension.location.toJSON(), relativeLocation: 'pub.a-1.0.0', version: extension.manifest.version }]);
	});

	test('extension in old format is not migrated if not exists in same location', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(ROOT, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: extension.location.toJSON(),
			version: extension.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined }]);

		const manifestContent = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(manifestContent, [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version }]);
	});

	test('extension in old format is read and migrated during write', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: extension.location.toJSON(),
			version: extension.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);
		const extension2 = aExtension('pub.b', joinPath(extensionsLocation, 'pub.b-1.0.0'));
		await testObject.addExtensionsToProfile([[extension2, undefined]], extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [
			{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined },
			{ identifier: extension2.identifier, location: extension2.location.toJSON(), version: extension2.manifest.version, metadata: undefined }
		]);

		const manifestContent = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(manifestContent, [
			{ identifier: extension.identifier, location: extension.location.toJSON(), relativeLocation: 'pub.a-1.0.0', version: extension.manifest.version },
			{ identifier: extension2.identifier, location: extension2.location.toJSON(), relativeLocation: 'pub.b-1.0.0', version: extension2.manifest.version }
		]);
	});

	test('extensions in old format and new format is read and migrated', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		const extension2 = aExtension('pub.b', joinPath(extensionsLocation, 'pub.b-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: extension.location.toJSON(),
			version: extension.manifest.version,
		}, {
			identifier: extension2.identifier,
			location: extension2.location.toJSON(),
			relativeLocation: 'pub.b-1.0.0',
			version: extension2.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [
			{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined },
			{ identifier: extension2.identifier, location: extension2.location.toJSON(), version: extension2.manifest.version, metadata: undefined }
		]);

		const manifestContent = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(manifestContent, [
			{ identifier: extension.identifier, location: extension.location.toJSON(), relativeLocation: 'pub.a-1.0.0', version: extension.manifest.version },
			{ identifier: extension2.identifier, location: extension2.location.toJSON(), relativeLocation: 'pub.b-1.0.0', version: extension2.manifest.version }
		]);
	});

	test('extension in intermediate format is read and migrated', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: 'pub.a-1.0.0',
			version: extension.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined }]);

		const manifestContent = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(manifestContent, [{ identifier: extension.identifier, location: extension.location.toJSON(), relativeLocation: 'pub.a-1.0.0', version: extension.manifest.version }]);
	});

	test('extension in intermediate format is read and migrated during write', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: 'pub.a-1.0.0',
			version: extension.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);
		const extension2 = aExtension('pub.b', joinPath(extensionsLocation, 'pub.b-1.0.0'));
		await testObject.addExtensionsToProfile([[extension2, undefined]], extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [
			{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined },
			{ identifier: extension2.identifier, location: extension2.location.toJSON(), version: extension2.manifest.version, metadata: undefined }
		]);

		const manifestContent = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(manifestContent, [
			{ identifier: extension.identifier, location: extension.location.toJSON(), relativeLocation: 'pub.a-1.0.0', version: extension.manifest.version },
			{ identifier: extension2.identifier, location: extension2.location.toJSON(), relativeLocation: 'pub.b-1.0.0', version: extension2.manifest.version }
		]);
	});

	test('extensions in intermediate and new format is read and migrated', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		const extension2 = aExtension('pub.b', joinPath(extensionsLocation, 'pub.b-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: 'pub.a-1.0.0',
			version: extension.manifest.version,
		}, {
			identifier: extension2.identifier,
			location: extension2.location.toJSON(),
			relativeLocation: 'pub.b-1.0.0',
			version: extension2.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [
			{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined },
			{ identifier: extension2.identifier, location: extension2.location.toJSON(), version: extension2.manifest.version, metadata: undefined }
		]);

		const manifestContent = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(manifestContent, [
			{ identifier: extension.identifier, location: extension.location.toJSON(), relativeLocation: 'pub.a-1.0.0', version: extension.manifest.version },
			{ identifier: extension2.identifier, location: extension2.location.toJSON(), relativeLocation: 'pub.b-1.0.0', version: extension2.manifest.version }
		]);
	});

	test('extensions in mixed format is read and migrated', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension1 = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		const extension2 = aExtension('pub.b', joinPath(extensionsLocation, 'pub.b-1.0.0'));
		const extension3 = aExtension('pub.c', joinPath(extensionsLocation, 'pub.c-1.0.0'));
		const extension4 = aExtension('pub.d', joinPath(ROOT, 'pub.d-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension1.identifier,
			location: 'pub.a-1.0.0',
			version: extension1.manifest.version,
		}, {
			identifier: extension2.identifier,
			location: extension2.location.toJSON(),
			version: extension2.manifest.version,
		}, {
			identifier: extension3.identifier,
			location: extension3.location.toJSON(),
			relativeLocation: 'pub.c-1.0.0',
			version: extension3.manifest.version,
		}, {
			identifier: extension4.identifier,
			location: extension4.location.toJSON(),
			version: extension4.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [
			{ identifier: extension1.identifier, location: extension1.location.toJSON(), version: extension1.manifest.version, metadata: undefined },
			{ identifier: extension2.identifier, location: extension2.location.toJSON(), version: extension2.manifest.version, metadata: undefined },
			{ identifier: extension3.identifier, location: extension3.location.toJSON(), version: extension3.manifest.version, metadata: undefined },
			{ identifier: extension4.identifier, location: extension4.location.toJSON(), version: extension4.manifest.version, metadata: undefined }
		]);

		const manifestContent = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(manifestContent, [
			{ identifier: extension1.identifier, location: extension1.location.toJSON(), relativeLocation: 'pub.a-1.0.0', version: extension1.manifest.version },
			{ identifier: extension2.identifier, location: extension2.location.toJSON(), relativeLocation: 'pub.b-1.0.0', version: extension2.manifest.version },
			{ identifier: extension3.identifier, location: extension3.location.toJSON(), relativeLocation: 'pub.c-1.0.0', version: extension3.manifest.version },
			{ identifier: extension4.identifier, location: extension4.location.toJSON(), version: extension4.manifest.version }
		]);
	});

	test('throws error if extension has invalid relativePath', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: extension.location.toJSON(),
			version: extension.manifest.version,
			relativePath: 2
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		try {
			await testObject.scanProfileExtensions(extensionsManifest);
			assert.fail('Should throw error');
		} catch (error) { /*expected*/ }
	});

	test('throws error if extension has no location', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			version: extension.manifest.version,
			relativePath: 'pub.a-1.0.0'
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		try {
			await testObject.scanProfileExtensions(extensionsManifest);
			assert.fail('Should throw error');
		} catch (error) { /*expected*/ }
	});

	test('throws error if extension location is invalid', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: {},
			version: extension.manifest.version,
			relativePath: 'pub.a-1.0.0'
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		try {
			await testObject.scanProfileExtensions(extensionsManifest);
			assert.fail('Should throw error');
		} catch (error) { /*expected*/ }
	});

	test('throws error if extension has no identifier', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			location: extension.location.toJSON(),
			version: extension.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		try {
			await testObject.scanProfileExtensions(extensionsManifest);
			assert.fail('Should throw error');
		} catch (error) { /*expected*/ }
	});

	test('throws error if extension identifier is invalid', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: 'pub.a',
			location: extension.location.toJSON(),
			version: extension.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		try {
			await testObject.scanProfileExtensions(extensionsManifest);
			assert.fail('Should throw error');
		} catch (error) { /*expected*/ }
	});

	test('throws error if extension has no version', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: extension.location.toJSON(),
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		try {
			await testObject.scanProfileExtensions(extensionsManifest);
			assert.fail('Should throw error');
		} catch (error) { /*expected*/ }
	});

	test('read extension when manifest is empty', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(''));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);
		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual, []);
	});

	test('read extension when manifest has empty lines and spaces', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(`


		`));
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);
		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual, []);
	});

	test('read extension when the relative location is empty', async () => {
		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(extensionsLocation, 'pub.a-1.0.0'));
		await instantiationService.get(IFileService).writeFile(extensionsManifest, VSBuffer.fromString(JSON.stringify([{
			identifier: extension.identifier,
			location: extension.location.toJSON(),
			relativeLocation: '',
			version: extension.manifest.version,
		}])));

		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined }]);

		const manifestContent = JSON.parse((await instantiationService.get(IFileService).readFile(extensionsManifest)).value.toString());
		assert.deepStrictEqual(manifestContent, [{ identifier: extension.identifier, location: extension.location.toJSON(), relativeLocation: 'pub.a-1.0.0', version: extension.manifest.version }]);
	});

	test('add extension trigger events', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);
		const target1 = sinon.stub();
		const target2 = sinon.stub();
		testObject.onAddExtensions(target1);
		testObject.onDidAddExtensions(target2);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(ROOT, 'foo', 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined }]);

		assert.ok(target1.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].identifier, extension.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].version, extension.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].location.toString(), extension.location.toString());

		assert.ok(target2.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].identifier, extension.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].version, extension.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].location.toString(), extension.location.toString());
	});

	test('remove extension trigger events', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);
		const target1 = sinon.stub();
		const target2 = sinon.stub();
		testObject.onRemoveExtensions(target1);
		testObject.onDidRemoveExtensions(target2);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');
		const extension = aExtension('pub.a', joinPath(ROOT, 'foo', 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);
		await testObject.removeExtensionFromProfile(extension, extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.length, 0);

		assert.ok(target1.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].identifier, extension.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].version, extension.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].location.toString(), extension.location.toString());

		assert.ok(target2.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].identifier, extension.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].version, extension.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].location.toString(), extension.location.toString());
	});

	test('add extension with same id but different version', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');

		const extension1 = aExtension('pub.a', joinPath(ROOT, 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension1, undefined]], extensionsManifest);

		const target1 = sinon.stub();
		const target2 = sinon.stub();
		const target3 = sinon.stub();
		const target4 = sinon.stub();
		testObject.onAddExtensions(target1);
		testObject.onRemoveExtensions(target2);
		testObject.onDidAddExtensions(target3);
		testObject.onDidRemoveExtensions(target4);
		const extension2 = aExtension('pub.a', joinPath(ROOT, 'pub.a-2.0.0'), undefined, { version: '2.0.0' });
		await testObject.addExtensionsToProfile([[extension2, undefined]], extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [{ identifier: extension2.identifier, location: extension2.location.toJSON(), version: extension2.manifest.version, metadata: undefined }]);

		assert.ok(target1.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].identifier, extension2.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].version, extension2.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].location.toString(), extension2.location.toString());

		assert.ok(target2.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].identifier, extension1.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].version, extension1.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].location.toString(), extension1.location.toString());

		assert.ok(target3.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].identifier, extension2.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].version, extension2.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].location.toString(), extension2.location.toString());

		assert.ok(target4.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].identifier, extension1.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].version, extension1.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].location.toString(), extension1.location.toString());
	});

	test('add same extension', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');

		const extension = aExtension('pub.a', joinPath(ROOT, 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);

		const target1 = sinon.stub();
		const target2 = sinon.stub();
		const target3 = sinon.stub();
		const target4 = sinon.stub();
		testObject.onAddExtensions(target1);
		testObject.onRemoveExtensions(target2);
		testObject.onDidAddExtensions(target3);
		testObject.onDidRemoveExtensions(target4);
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined }]);
		assert.ok(target1.notCalled);
		assert.ok(target2.notCalled);
		assert.ok(target3.notCalled);
		assert.ok(target4.notCalled);
	});

	test('add same extension with different metadata', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');

		const extension = aExtension('pub.a', joinPath(ROOT, 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);

		const target1 = sinon.stub();
		const target2 = sinon.stub();
		const target3 = sinon.stub();
		const target4 = sinon.stub();
		testObject.onAddExtensions(target1);
		testObject.onRemoveExtensions(target2);
		testObject.onDidAddExtensions(target3);
		testObject.onDidRemoveExtensions(target4);
		await testObject.addExtensionsToProfile([[extension, { isApplicationScoped: true }]], extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON(), metadata: a.metadata })), [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: { isApplicationScoped: true } }]);
		assert.ok(target1.notCalled);
		assert.ok(target2.notCalled);
		assert.ok(target3.notCalled);
		assert.ok(target4.notCalled);
	});

	test('add extension with different version and metadata', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');

		const extension1 = aExtension('pub.a', joinPath(ROOT, 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension1, undefined]], extensionsManifest);
		const extension2 = aExtension('pub.a', joinPath(ROOT, 'pub.a-2.0.0'), undefined, { version: '2.0.0' });

		const target1 = sinon.stub();
		const target2 = sinon.stub();
		const target3 = sinon.stub();
		const target4 = sinon.stub();
		testObject.onAddExtensions(target1);
		testObject.onRemoveExtensions(target2);
		testObject.onDidAddExtensions(target3);
		testObject.onDidRemoveExtensions(target4);
		await testObject.addExtensionsToProfile([[extension2, { isApplicationScoped: true }]], extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON(), metadata: a.metadata })), [{ identifier: extension2.identifier, location: extension2.location.toJSON(), version: extension2.manifest.version, metadata: { isApplicationScoped: true } }]);

		assert.ok(target1.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].identifier, extension2.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].version, extension2.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].location.toString(), extension2.location.toString());

		assert.ok(target2.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].identifier, extension1.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].version, extension1.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].location.toString(), extension1.location.toString());

		assert.ok(target3.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].identifier, extension2.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].version, extension2.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target1.args[0][0])).extensions[0].location.toString(), extension2.location.toString());

		assert.ok(target4.calledOnce);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).profileLocation.toString(), extensionsManifest.toString());
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions.length, 1);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].identifier, extension1.identifier);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].version, extension1.manifest.version);
		assert.deepStrictEqual((<ProfileExtensionsEvent>(target2.args[0][0])).extensions[0].location.toString(), extension1.location.toString());
	});

	test('add extension with same id and version located in the different folder', async () => {
		const testObject = instantiationService.createInstance(TestObject, extensionsLocation);

		const extensionsManifest = joinPath(extensionsLocation, 'extensions.json');

		let extension = aExtension('pub.a', joinPath(ROOT, 'foo', 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);

		const target1 = sinon.stub();
		const target2 = sinon.stub();
		const target3 = sinon.stub();
		const target4 = sinon.stub();
		testObject.onAddExtensions(target1);
		testObject.onRemoveExtensions(target2);
		testObject.onDidAddExtensions(target3);
		testObject.onDidRemoveExtensions(target4);
		extension = aExtension('pub.a', joinPath(ROOT, 'pub.a-1.0.0'));
		await testObject.addExtensionsToProfile([[extension, undefined]], extensionsManifest);

		const actual = await testObject.scanProfileExtensions(extensionsManifest);
		assert.deepStrictEqual(actual.map(a => ({ ...a, location: a.location.toJSON() })), [{ identifier: extension.identifier, location: extension.location.toJSON(), version: extension.manifest.version, metadata: undefined }]);
		assert.ok(target1.notCalled);
		assert.ok(target2.notCalled);
		assert.ok(target3.notCalled);
		assert.ok(target4.notCalled);
	});

	function aExtension(id: string, location: URI, e?: Partial<IExtension>, manifest?: Partial<IExtensionManifest>): IExtension {
		return {
			identifier: { id },
			location,
			type: ExtensionType.User,
			targetPlatform: TargetPlatform.DARWIN_X64,
			isBuiltin: false,
			manifest: {
				name: 'name',
				publisher: 'publisher',
				version: '1.0.0',
				engines: { vscode: '1.0.0' },
				...manifest,
			},
			isValid: true,
			validations: [],
			...e
		};
	}

});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { timeout } from 'vs/base/common/async';
import { newWriteableBufferStream, VSBuffer } from 'vs/base/common/buffer';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Event } from 'vs/base/common/event';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { isWeb } from 'vs/base/common/platform';
import { ConfigurationSyncStore } from 'vs/base/common/product';
import { URI } from 'vs/base/common/uri';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IFileService } from 'vs/platform/files/common/files';
import { NullLogService } from 'vs/platform/log/common/log';
import product from 'vs/platform/product/common/product';
import { IProductService } from 'vs/platform/product/common/productService';
import { IRequestService } from 'vs/platform/request/common/request';
import { IUserDataSyncStore, IUserDataSyncStoreManagementService, IUserDataSyncStoreService, SyncResource, UserDataSyncErrorCode, UserDataSyncStoreError } from 'vs/platform/userDataSync/common/userDataSync';
import { RequestsSession, UserDataSyncStoreManagementService, UserDataSyncStoreService } from 'vs/platform/userDataSync/common/userDataSyncStoreService';
import { UserDataSyncClient, UserDataSyncTestServer } from 'vs/platform/userDataSync/test/common/userDataSyncClient';

suite('UserDataSyncStoreManagementService', () => {
	const disposableStore = new DisposableStore();

	teardown(() => disposableStore.clear());

	test('test sync store is read from settings', async () => {
		const client = disposableStore.add(new UserDataSyncClient(new UserDataSyncTestServer()));
		await client.setUp();

		client.instantiationService.stub(IProductService, {
			_serviceBrand: undefined, ...product, ...{
				'configurationSync.store': undefined
			}
		});

		const configuredStore: ConfigurationSyncStore = {
			url: 'http://configureHost:3000',
			stableUrl: 'http://configureHost:3000',
			insidersUrl: 'http://configureHost:3000',
			canSwitch: false,
			authenticationProviders: { 'configuredAuthProvider': { scopes: [] } }
		};
		await client.instantiationService.get(IFileService).writeFile(client.instantiationService.get(IEnvironmentService).settingsResource, VSBuffer.fromString(JSON.stringify({
			'configurationSync.store': configuredStore
		})));
		await client.instantiationService.get(IConfigurationService).reloadConfiguration();

		const expected: IUserDataSyncStore = {
			url: URI.parse('http://configureHost:3000'),
			type: 'stable',
			defaultUrl: URI.parse('http://configureHost:3000'),
			stableUrl: URI.parse('http://configureHost:3000'),
			insidersUrl: URI.parse('http://configureHost:3000'),
			canSwitch: false,
			authenticationProviders: [{ id: 'configuredAuthProvider', scopes: [] }]
		};

		const testObject: IUserDataSyncStoreManagementService = disposableStore.add(client.instantiationService.createInstance(UserDataSyncStoreManagementService));

		assert.strictEqual(testObject.userDataSyncStore?.url.toString(), expected.url.toString());
		assert.strictEqual(testObject.userDataSyncStore?.defaultUrl.toString(), expected.defaultUrl.toString());
		assert.deepStrictEqual(testObject.userDataSyncStore?.authenticationProviders, expected.authenticationProviders);
	});

});

suite('UserDataSyncStoreService', () => {

	const disposableStore = new DisposableStore();

	teardown(() => disposableStore.clear());

	test('test read manifest for the first time', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);
		const productService = client.instantiationService.get(IProductService);

		await testObject.manifest(null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-Client-Name'], `${productService.applicationName}${isWeb ? '-web' : ''}`);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-Client-Version'], productService.version);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Id'], undefined);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], undefined);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
	});

	test('test read manifest for the second time when session is not yet created', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];

		target.reset();
		await testObject.manifest(null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
	});

	test('test session id header is not set in the first manifest request after session is created', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];
		await testObject.write(SyncResource.Settings, 'some content', null);

		target.reset();
		await testObject.manifest(null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
	});

	test('test session id header is set from the second manifest request after session is created', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];
		await testObject.write(SyncResource.Settings, 'some content', null);
		await testObject.manifest(null);

		target.reset();
		await testObject.manifest(null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
	});

	test('test headers are send for write request', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];
		await testObject.write(SyncResource.Settings, 'some content', null);
		await testObject.manifest(null);
		await testObject.manifest(null);

		target.reset();
		await testObject.write(SyncResource.Settings, 'some content', null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
	});

	test('test headers are send for read request', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];
		await testObject.write(SyncResource.Settings, 'some content', null);
		await testObject.manifest(null);
		await testObject.manifest(null);

		target.reset();
		await testObject.read(SyncResource.Settings, null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
	});

	test('test headers are reset after session is cleared ', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];
		await testObject.write(SyncResource.Settings, 'some content', null);
		await testObject.manifest(null);
		await testObject.manifest(null);
		await testObject.clear();

		target.reset();
		await testObject.manifest(null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], undefined);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
	});

	test('test old headers are sent after session is changed on server ', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		await testObject.write(SyncResource.Settings, 'some content', null);
		await testObject.manifest(null);
		target.reset();
		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];
		const userSessionId = target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'];
		await target.clear();

		// client 2
		const client2 = disposableStore.add(new UserDataSyncClient(target));
		await client2.setUp();
		const testObject2 = client2.instantiationService.get(IUserDataSyncStoreService);
		await testObject2.write(SyncResource.Settings, 'some content', null);

		target.reset();
		await testObject.manifest(null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], undefined);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], userSessionId);
	});

	test('test old headers are reset from second request after session is changed on server ', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		await testObject.write(SyncResource.Settings, 'some content', null);
		await testObject.manifest(null);
		target.reset();
		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];
		const userSessionId = target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'];
		await target.clear();

		// client 2
		const client2 = disposableStore.add(new UserDataSyncClient(target));
		await client2.setUp();
		const testObject2 = client2.instantiationService.get(IUserDataSyncStoreService);
		await testObject2.write(SyncResource.Settings, 'some content', null);

		await testObject.manifest(null);
		target.reset();
		await testObject.manifest(null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], undefined);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], userSessionId);
	});

	test('test old headers are sent after session is cleared from another server ', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		await testObject.write(SyncResource.Settings, 'some content', null);
		await testObject.manifest(null);
		target.reset();
		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];
		const userSessionId = target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'];

		// client 2
		const client2 = disposableStore.add(new UserDataSyncClient(target));
		await client2.setUp();
		const testObject2 = client2.instantiationService.get(IUserDataSyncStoreService);
		await testObject2.clear();

		target.reset();
		await testObject.manifest(null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], undefined);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], userSessionId);
	});

	test('test headers are reset after session is cleared from another server ', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		await testObject.write(SyncResource.Settings, 'some content', null);
		await testObject.manifest(null);
		target.reset();
		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];

		// client 2
		const client2 = disposableStore.add(new UserDataSyncClient(target));
		await client2.setUp();
		const testObject2 = client2.instantiationService.get(IUserDataSyncStoreService);
		await testObject2.clear();

		await testObject.manifest(null);
		target.reset();
		await testObject.manifest(null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], undefined);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.strictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
	});

	test('test headers are reset after session is cleared from another server - started syncing again', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		await testObject.write(SyncResource.Settings, 'some content', null);
		await testObject.manifest(null);
		target.reset();
		await testObject.manifest(null);
		const machineSessionId = target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'];
		const userSessionId = target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'];

		// client 2
		const client2 = disposableStore.add(new UserDataSyncClient(target));
		await client2.setUp();
		const testObject2 = client2.instantiationService.get(IUserDataSyncStoreService);
		await testObject2.clear();

		await testObject.manifest(null);
		await testObject.write(SyncResource.Settings, 'some content', null);
		await testObject.manifest(null);
		target.reset();
		await testObject.manifest(null);

		assert.strictEqual(target.requestsWithAllHeaders.length, 1);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], undefined);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-Machine-Session-Id'], machineSessionId);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], userSessionId);
		assert.notStrictEqual(target.requestsWithAllHeaders[0].headers!['X-User-Session-Id'], undefined);
	});

	test('test rate limit on server with retry after', async () => {
		const target = new UserDataSyncTestServer(1, 1);
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);

		const promise = Event.toPromise(testObject.onDidChangeDonotMakeRequestsUntil);
		try {
			await testObject.manifest(null);
			assert.fail('should fail');
		} catch (e) {
			assert.ok(e instanceof UserDataSyncStoreError);
			assert.deepStrictEqual((<UserDataSyncStoreError>e).code, UserDataSyncErrorCode.TooManyRequestsAndRetryAfter);
			await promise;
			assert.ok(!!testObject.donotMakeRequestsUntil);
		}
	});

	test('test donotMakeRequestsUntil is reset after retry time is finished', async () => {
		const client = disposableStore.add(new UserDataSyncClient(new UserDataSyncTestServer(1, 0.25)));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		try {
			await testObject.manifest(null);
		} catch (e) { }

		const promise = Event.toPromise(testObject.onDidChangeDonotMakeRequestsUntil);
		await timeout(300);
		await promise;
		assert.ok(!testObject.donotMakeRequestsUntil);
	});

	test('test donotMakeRequestsUntil is retrieved', async () => {
		const client = disposableStore.add(new UserDataSyncClient(new UserDataSyncTestServer(1, 1)));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		try {
			await testObject.manifest(null);
		} catch (e) { }

		const target = disposableStore.add(client.instantiationService.createInstance(UserDataSyncStoreService));
		assert.strictEqual(target.donotMakeRequestsUntil?.getTime(), testObject.donotMakeRequestsUntil?.getTime());
	});

	test('test donotMakeRequestsUntil is checked and reset after retreived', async () => {
		const client = disposableStore.add(new UserDataSyncClient(new UserDataSyncTestServer(1, 0.25)));
		await client.setUp();
		const testObject = client.instantiationService.get(IUserDataSyncStoreService);

		await testObject.manifest(null);
		try {
			await testObject.manifest(null);
		} catch (e) { }

		await timeout(300);
		const target = disposableStore.add(client.instantiationService.createInstance(UserDataSyncStoreService));
		assert.ok(!target.donotMakeRequestsUntil);
	});

	test('test read resource request handles 304', async () => {
		// Setup the client
		const target = new UserDataSyncTestServer();
		const client = disposableStore.add(new UserDataSyncClient(target));
		await client.setUp();
		await client.sync();

		const testObject = client.instantiationService.get(IUserDataSyncStoreService);
		const expected = await testObject.read(SyncResource.Settings, null);
		const actual = await testObject.read(SyncResource.Settings, expected);

		assert.strictEqual(actual, expected);
	});

});

suite('UserDataSyncRequestsSession', () => {

	const requestService: IRequestService = {
		_serviceBrand: undefined,
		async request() { return { res: { headers: {} }, stream: newWriteableBufferStream() }; },
		async resolveProxy() { return undefined; }
	};

	test('too many requests are thrown when limit exceeded', async () => {
		const testObject = new RequestsSession(1, 500, requestService, new NullLogService());
		await testObject.request('url', {}, CancellationToken.None);

		try {
			await testObject.request('url', {}, CancellationToken.None);
		} catch (error) {
			assert.ok(error instanceof UserDataSyncStoreError);
			assert.strictEqual((<UserDataSyncStoreError>error).code, UserDataSyncErrorCode.LocalTooManyRequests);
			return;
		}
		assert.fail('Should fail with limit exceeded');
	});

	test('requests are handled after session is expired', async () => {
		const testObject = new RequestsSession(1, 500, requestService, new NullLogService());
		await testObject.request('url', {}, CancellationToken.None);
		await timeout(600);
		await testObject.request('url', {}, CancellationToken.None);
	});

	test('too many requests are thrown after session is expired', async () => {
		const testObject = new RequestsSession(1, 500, requestService, new NullLogService());
		await testObject.request('url', {}, CancellationToken.None);
		await timeout(600);
		await testObject.request('url', {}, CancellationToken.None);

		try {
			await testObject.request('url', {}, CancellationToken.None);
		} catch (error) {
			assert.ok(error instanceof UserDataSyncStoreError);
			assert.strictEqual((<UserDataSyncStoreError>error).code, UserDataSyncErrorCode.LocalTooManyRequests);
			return;
		}
		assert.fail('Should fail with limit exceeded');
	});

});

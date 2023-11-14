/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Event } from 'vs/base/common/event';
import { IChannel } from 'vs/base/parts/ipc/common/ipc';
import { Client } from 'vs/base/parts/ipc/node/ipc.cp';
import { ITestService, TestServiceClient } from './testService';
import { FileAccess } from 'vs/base/common/network';

function createClient(): Client {
	return new Client(FileAccess.asFileUri('bootstrap-fork').fsPath, {
		serverName: 'TestServer',
		env: { VSCODE_AMD_ENTRYPOINT: 'vs/base/parts/ipc/test/node/testApp', verbose: true }
	});
}

suite('IPC, Child Process', function () {
	this.slow(2000);
	this.timeout(10000);

	let client: Client;
	let channel: IChannel;
	let service: ITestService;

	setup(() => {
		client = createClient();
		channel = client.getChannel('test');
		service = new TestServiceClient(channel);
	});

	teardown(() => {
		client.dispose();
	});

	test('createChannel', async () => {
		const result = await service.pong('ping');
		assert.strictEqual(result.incoming, 'ping');
		assert.strictEqual(result.outgoing, 'pong');
	});

	test('events', async () => {
		const event = Event.toPromise(Event.once(service.onMarco));
		const promise = service.marco();

		const [promiseResult, eventResult] = await Promise.all([promise, event]);

		assert.strictEqual(promiseResult, 'polo');
		assert.strictEqual(eventResult.answer, 'polo');
	});

	test('event dispose', async () => {
		let count = 0;
		const disposable = service.onMarco(() => count++);

		const answer = await service.marco();
		assert.strictEqual(answer, 'polo');
		assert.strictEqual(count, 1);

		const answer_1 = await service.marco();
		assert.strictEqual(answer_1, 'polo');
		assert.strictEqual(count, 2);
		disposable.dispose();

		const answer_2 = await service.marco();
		assert.strictEqual(answer_2, 'polo');
		assert.strictEqual(count, 2);
	});
});

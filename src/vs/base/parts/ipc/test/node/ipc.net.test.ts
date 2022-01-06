/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { EventEmitter } from 'events';
import { createServer, Socket } from 'net';
import { tmpdir } from 'os';
import { VSBuffer } from 'vs/base/common/buffer';
import { Disposable } from 'vs/base/common/lifecycle';
import { PersistentProtocol, Protocol } from 'vs/base/parts/ipc/common/ipc.net';
import { createRandomIPCHandle, createStaticIPCHandle, NodeSocket } from 'vs/base/parts/ipc/node/ipc.net';
import { ensureNoDisposablesAreLeakedInTestSuite } from 'vs/base/test/common/utils';
import product from 'vs/platform/product/common/product';

class MessageStream extends Disposable {

	private _currentComplete: ((data: VSBuffer) => void) | null;
	private _messages: VSBuffer[];

	constructor(x: Protocol | PersistentProtocol) {
		super();
		this._currentComplete = null;
		this._messages = [];
		this._register(x.onMessage(data => {
			this._messages.push(data);
			this._trigger();
		}));
	}

	private _trigger(): void {
		if (!this._currentComplete) {
			return;
		}
		if (this._messages.length === 0) {
			return;
		}
		const complete = this._currentComplete;
		const msg = this._messages.shift()!;

		this._currentComplete = null;
		complete(msg);
	}

	public waitForOne(): Promise<VSBuffer> {
		return new Promise<VSBuffer>((complete) => {
			this._currentComplete = complete;
			this._trigger();
		});
	}
}

class EtherStream extends EventEmitter {
	constructor(
		private readonly _ether: Ether,
		private readonly _name: 'a' | 'b'
	) {
		super();
	}

	write(data: Buffer, cb?: Function): boolean {
		if (!Buffer.isBuffer(data)) {
			throw new Error(`Invalid data`);
		}
		this._ether.write(this._name, data);
		return true;
	}
}

class Ether {

	private readonly _a: EtherStream;
	private readonly _b: EtherStream;

	private _ab: Buffer[];
	private _ba: Buffer[];

	public get a(): Socket {
		return <any>this._a;
	}

	public get b(): Socket {
		return <any>this._b;
	}

	constructor() {
		this._a = new EtherStream(this, 'a');
		this._b = new EtherStream(this, 'b');
		this._ab = [];
		this._ba = [];
	}

	public write(from: 'a' | 'b', data: Buffer): void {
		if (from === 'a') {
			this._ab.push(data);
		} else {
			this._ba.push(data);
		}

		setImmediate(() => this._deliver());
	}

	private _deliver(): void {

		if (this._ab.length > 0) {
			const data = Buffer.concat(this._ab);
			this._ab.length = 0;
			this._b.emit('data', data);
			setImmediate(() => this._deliver());
			return;
		}

		if (this._ba.length > 0) {
			const data = Buffer.concat(this._ba);
			this._ba.length = 0;
			this._a.emit('data', data);
			setImmediate(() => this._deliver());
			return;
		}

	}
}

suite('IPC, Socket Protocol', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	let ether: Ether;

	setup(() => {
		ether = new Ether();
	});

	test('read/write', async () => {

		const a = new Protocol(new NodeSocket(ether.a));
		const b = new Protocol(new NodeSocket(ether.b));
		const bMessages = new MessageStream(b);

		a.send(VSBuffer.fromString('foobarfarboo'));
		const msg1 = await bMessages.waitForOne();
		assert.strictEqual(msg1.toString(), 'foobarfarboo');

		const buffer = VSBuffer.alloc(1);
		buffer.writeUInt8(123, 0);
		a.send(buffer);
		const msg2 = await bMessages.waitForOne();
		assert.strictEqual(msg2.readUInt8(0), 123);

		bMessages.dispose();
		a.dispose();
		b.dispose();
	});


	test('read/write, object data', async () => {

		const a = new Protocol(new NodeSocket(ether.a));
		const b = new Protocol(new NodeSocket(ether.b));
		const bMessages = new MessageStream(b);

		const data = {
			pi: Math.PI,
			foo: 'bar',
			more: true,
			data: 'Hello World'.split('')
		};

		a.send(VSBuffer.fromString(JSON.stringify(data)));
		const msg = await bMessages.waitForOne();
		assert.deepStrictEqual(JSON.parse(msg.toString()), data);

		bMessages.dispose();
		a.dispose();
		b.dispose();
	});

});

suite('PersistentProtocol reconnection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	let ether: Ether;

	setup(() => {
		ether = new Ether();
	});

	test('acks get piggybacked with messages', async () => {
		const a = new PersistentProtocol(new NodeSocket(ether.a));
		const aMessages = new MessageStream(a);
		const b = new PersistentProtocol(new NodeSocket(ether.b));
		const bMessages = new MessageStream(b);

		a.send(VSBuffer.fromString('a1'));
		assert.strictEqual(a.unacknowledgedCount, 1);
		assert.strictEqual(b.unacknowledgedCount, 0);

		a.send(VSBuffer.fromString('a2'));
		assert.strictEqual(a.unacknowledgedCount, 2);
		assert.strictEqual(b.unacknowledgedCount, 0);

		a.send(VSBuffer.fromString('a3'));
		assert.strictEqual(a.unacknowledgedCount, 3);
		assert.strictEqual(b.unacknowledgedCount, 0);

		const a1 = await bMessages.waitForOne();
		assert.strictEqual(a1.toString(), 'a1');
		assert.strictEqual(a.unacknowledgedCount, 3);
		assert.strictEqual(b.unacknowledgedCount, 0);

		const a2 = await bMessages.waitForOne();
		assert.strictEqual(a2.toString(), 'a2');
		assert.strictEqual(a.unacknowledgedCount, 3);
		assert.strictEqual(b.unacknowledgedCount, 0);

		const a3 = await bMessages.waitForOne();
		assert.strictEqual(a3.toString(), 'a3');
		assert.strictEqual(a.unacknowledgedCount, 3);
		assert.strictEqual(b.unacknowledgedCount, 0);

		b.send(VSBuffer.fromString('b1'));
		assert.strictEqual(a.unacknowledgedCount, 3);
		assert.strictEqual(b.unacknowledgedCount, 1);

		const b1 = await aMessages.waitForOne();
		assert.strictEqual(b1.toString(), 'b1');
		assert.strictEqual(a.unacknowledgedCount, 0);
		assert.strictEqual(b.unacknowledgedCount, 1);

		a.send(VSBuffer.fromString('a4'));
		assert.strictEqual(a.unacknowledgedCount, 1);
		assert.strictEqual(b.unacknowledgedCount, 1);

		const b2 = await bMessages.waitForOne();
		assert.strictEqual(b2.toString(), 'a4');
		assert.strictEqual(a.unacknowledgedCount, 1);
		assert.strictEqual(b.unacknowledgedCount, 0);

		aMessages.dispose();
		bMessages.dispose();
		a.dispose();
		b.dispose();
	});
});

suite('IPC, create handle', () => {

	test('createRandomIPCHandle', async () => {
		return testIPCHandle(createRandomIPCHandle());
	});

	test('createStaticIPCHandle', async () => {
		return testIPCHandle(createStaticIPCHandle(tmpdir(), 'test', product.version));
	});

	function testIPCHandle(handle: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const pipeName = createRandomIPCHandle();

			const server = createServer();

			server.on('error', () => {
				return new Promise(() => server.close(() => reject()));
			});

			server.listen(pipeName, () => {
				server.removeListener('error', reject);

				return new Promise(() => {
					server.close(() => resolve());
				});
			});
		});
	}

});

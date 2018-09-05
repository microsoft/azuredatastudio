/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { onUnexpectedError } from 'vs/base/common/errors';
import { ExtensionHostMain, exit } from 'vs/workbench/node/extensionHostMain';
import { IInitData } from 'vs/workbench/api/node/extHost.protocol';
import { IMessagePassingProtocol } from 'vs/base/parts/ipc/common/ipc';
import { Protocol } from 'vs/base/parts/ipc/node/ipc.net';
import { createConnection } from 'net';
import { Event, filterEvent } from 'vs/base/common/event';

// With Electron 2.x and node.js 8.x the "natives" module
// can cause a native crash (see https://github.com/nodejs/node/issues/19891 and
// https://github.com/electron/electron/issues/10905). To prevent this from
// happening we essentially blocklist this module from getting loaded in any
// extension by patching the node require() function.
(function () {
	const Module = require.__$__nodeRequire('module') as any;
	const originalLoad = Module._load;

	Module._load = function (request) {
		if (request === 'natives') {
			throw new Error('Either the extension or a NPM dependency is using the "natives" node module which is unsupported as it can cause a crash of the extension host. Click [here](https://go.microsoft.com/fwlink/?linkid=871887) to find out more');
		}

		return originalLoad.apply(this, arguments);
	};
})();

interface IRendererConnection {
	protocol: IMessagePassingProtocol;
	initData: IInitData;
}

// This calls exit directly in case the initialization is not finished and we need to exit
// Otherwise, if initialization completed we go to extensionHostMain.terminate()
let onTerminate = function () {
	exit();
};

function createExtHostProtocol(): Promise<IMessagePassingProtocol> {

	const pipeName = process.env.VSCODE_IPC_HOOK_EXTHOST;

	return new Promise<IMessagePassingProtocol>((resolve, reject) => {

		const socket = createConnection(pipeName, () => {
			socket.removeListener('error', reject);
			resolve(new Protocol(socket));
		});
		socket.once('error', reject);

	}).then(protocol => {

		return new class implements IMessagePassingProtocol {

			private _terminating = false;

			readonly onMessage: Event<any> = filterEvent(protocol.onMessage, msg => {
				if (msg.type !== '__$terminate') {
					return true;
				}
				this._terminating = true;
				onTerminate();
				return false;
			});

			send(msg: any): void {
				if (!this._terminating) {
					protocol.send(msg);
				}
			}
		};
	});
}

function connectToRenderer(protocol: IMessagePassingProtocol): Promise<IRendererConnection> {
	return new Promise<IRendererConnection>((c, e) => {

		// Listen init data message
		const first = protocol.onMessage(raw => {
			first.dispose();

			const initData = <IInitData>JSON.parse(raw);

			// Print a console message when rejection isn't handled within N seconds. For details:
			// see https://nodejs.org/api/process.html#process_event_unhandledrejection
			// and https://nodejs.org/api/process.html#process_event_rejectionhandled
			const unhandledPromises: Promise<any>[] = [];
			process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
				unhandledPromises.push(promise);
				setTimeout(() => {
					const idx = unhandledPromises.indexOf(promise);
					if (idx >= 0) {
						unhandledPromises.splice(idx, 1);
						console.warn('rejected promise not handled within 1 second');
						onUnexpectedError(reason);
					}
				}, 1000);
			});
			process.on('rejectionHandled', (promise: Promise<any>) => {
				const idx = unhandledPromises.indexOf(promise);
				if (idx >= 0) {
					unhandledPromises.splice(idx, 1);
				}
			});

			// Print a console message when an exception isn't handled.
			process.on('uncaughtException', function (err: Error) {
				onUnexpectedError(err);
			});

			process.on('SIGPIPE', () => {
				onUnexpectedError(new Error('Unexpected SIGPIPE'));
			});

			// Kill oneself if one's parent dies. Much drama.
			setInterval(function () {
				try {
					process.kill(initData.parentPid, 0); // throws an exception if the main process doesn't exist anymore.
				} catch (e) {
					onTerminate();
				}
			}, 5000);

			// Tell the outside that we are initialized
			protocol.send('initialized');

			c({ protocol, initData });
		});

		// Tell the outside that we are ready to receive messages
		protocol.send('ready');
	});
}

patchExecArgv();

createExtHostProtocol().then(protocol => {
	// connect to main side
	return connectToRenderer(protocol);
}).then(renderer => {
	// setup things
	const extensionHostMain = new ExtensionHostMain(renderer.protocol, renderer.initData);
	onTerminate = () => extensionHostMain.terminate();
	return extensionHostMain.start();
}).catch(err => console.error(err));

function patchExecArgv() {
	// when encountering the prevent-inspect flag we delete this
	// and the prior flag
	if (process.env.VSCODE_PREVENT_FOREIGN_INSPECT) {
		for (let i = 0; i < process.execArgv.length; i++) {
			if (process.execArgv[i].match(/--inspect-brk=\d+|--inspect=\d+/)) {
				process.execArgv.splice(i, 1);
				break;
			}
		}
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// This code is originally from https://github.com/Microsoft/vscode/blob/master/src/vs/base/node/ports.ts

'use strict';

import * as net from 'net';

export class StrictPortFindOptions {
	constructor(public startPort: number, public minPort: number, public maxport: number) {
	}
	public maxRetriesPerStartPort: number = 5;
	public totalRetryLoops: number = 10;
	public timeout: number = 5000;
}

/**
 * Searches for a free port with additional retries and a function to search in a much larger range if initial
 * attempt to find a port fails. By skipping to a random port after the first time failing, this should help
 * reduce the likelihood that no free port can be found.
 */
export async function strictFindFreePort(options: StrictPortFindOptions): Promise<number> {
	let totalRetries = options.totalRetryLoops;
	let startPort = options.startPort;
	let port = await findFreePort(startPort, options.maxRetriesPerStartPort, options.timeout);
	while (port === 0 && totalRetries > 0) {
		startPort = getRandomInt(options.minPort, options.maxport);
		port = await findFreePort(startPort, options.maxRetriesPerStartPort, options.timeout);
		totalRetries--;
	}
	return port;
}

/**
 * Get a random integer between `min` and `max`.
 *
 * @param {number} min - min number
 * @param {number} max - max number
 * @return {number} a random integer
 */
function getRandomInt(min, max): number {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Given a start point and a max number of retries, will find a port that
 * is openable. Will return 0 in case no free port can be found.
 */
export function findFreePort(startPort: number, giveUpAfter: number, timeout: number): Thenable<number> {
	let done = false;

	return new Promise(resolve => {
		const timeoutHandle = setTimeout(() => {
			if (!done) {
				done = true;
				return resolve(0);
			}
		}, timeout);

		doFindFreePort(startPort, giveUpAfter, (port) => {
			if (!done) {
				done = true;
				clearTimeout(timeoutHandle);
				return resolve(port);
			}
		});
	});
}

function doFindFreePort(startPort: number, giveUpAfter: number, clb: (port: number) => void): void {
	if (giveUpAfter === 0) {
		return clb(0);
	}

	const client = new net.Socket();

	// If we can connect to the port it means the port is already taken so we continue searching
	client.once('connect', () => {
		dispose(client);

		return doFindFreePort(startPort + 1, giveUpAfter - 1, clb);
	});

	client.once('data', () => {
		// this listener is required since node.js 8.x
	});

	client.once('error', (err: Error & { code?: string }) => {
		dispose(client);

		// If we receive any non ECONNREFUSED error, it means the port is used but we cannot connect
		if (err.code !== 'ECONNREFUSED') {
			return doFindFreePort(startPort + 1, giveUpAfter - 1, clb);
		}

		// Otherwise it means the port is free to use!
		return clb(startPort);
	});

	client.connect(startPort, '127.0.0.1');
}

function dispose(socket: net.Socket): void {
	try {
		socket.removeAllListeners('connect');
		socket.removeAllListeners('error');
		socket.end();
		socket.destroy();
		socket.unref();
	} catch (error) {
		console.error(error); // otherwise this error would get lost in the callback chain
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { tmpdir } from 'os';
import { Queue } from 'vs/base/common/async';
import { randomPath } from 'vs/base/common/extpath';
import { Promises } from 'vs/base/node/pfs';
import { resolveTerminalEncoding } from 'vs/base/node/terminalEncoding';

export function hasStdinWithoutTty() {
	try {
		return !process.stdin.isTTY; // Via https://twitter.com/MylesBorins/status/782009479382626304
	} catch (error) {
		// Windows workaround for https://github.com/nodejs/node/issues/11656
	}
	return false;
}

export function stdinDataListener(durationinMs: number): Promise<boolean> {
	return new Promise(resolve => {
		const dataListener = () => resolve(true);

		// wait for 1s maximum...
		setTimeout(() => {
			process.stdin.removeListener('data', dataListener);

			resolve(false);
		}, durationinMs);

		// ...but finish early if we detect data
		process.stdin.once('data', dataListener);
	});
}

export function getStdinFilePath(): string {
	return randomPath(tmpdir(), 'code-stdin', 3);
}

export async function readFromStdin(targetPath: string, verbose: boolean): Promise<void> {

	let [encoding, iconv] = await Promise.all([
		resolveTerminalEncoding(verbose),	// respect terminal encoding when piping into file
		import('@vscode/iconv-lite-umd'),	// lazy load encoding module for usage
		Promises.appendFile(targetPath, '') // make sure file exists right away (https://github.com/microsoft/vscode/issues/155341)
	]);

	if (!iconv.encodingExists(encoding)) {
		console.log(`Unsupported terminal encoding: ${encoding}, falling back to UTF-8.`);
		encoding = 'utf8';
	}

	// Use a `Queue` to be able to use `appendFile`
	// which helps file watchers to be aware of the
	// changes because each append closes the underlying
	// file descriptor.
	// (https://github.com/microsoft/vscode/issues/148952)

	const appendFileQueue = new Queue();

	const decoder = iconv.getDecoder(encoding);

	process.stdin.on('data', chunk => {
		const chunkStr = decoder.write(chunk);
		appendFileQueue.queue(() => Promises.appendFile(targetPath, chunkStr));
	});

	process.stdin.on('end', () => {
		const end = decoder.end();
		if (typeof end === 'string') {
			appendFileQueue.queue(() => Promises.appendFile(targetPath, end));
		}
	});
}

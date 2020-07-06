/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { promises as fs } from 'fs';

export async function assertThrowsAsync(fn: () => Promise<any>, msg: string): Promise<void> {
	let f = () => {
		// Empty
	};
	try {
		await fn();
	} catch (e) {
		f = () => { throw e; };
	} finally {
		assert.throws(f, msg);
	}
}

export async function sleep(ms: number): Promise<{}> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function tryDeleteFile(path: string): Promise<void> {
	try {
		await fs.unlink(path);
	} catch {
		console.warn(`Could not delete file ${path}`);
	}
}

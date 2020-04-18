/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';

import 'mocha';

import { FileDatabase } from '../../../account-provider/utils/fileDatabase';

let fileDatabase: FileDatabase;
let fileName: string;

const k1 = 'k1';
const v1 = 'v1';

const k2 = 'k2';
const v2 = 'v2';

const fakeDB = {
	k1: v1,
	k2: v2
};

// These tests don't work on Linux systems because gnome-keyring doesn't like running on headless machines.
describe('AccountProvider.FileDatabase', function (): void {
	beforeEach(async function (): Promise<void> {
		fileName = crypto.randomBytes(4).toString('hex');
		fileDatabase = new FileDatabase(path.join(os.tmpdir(), fileName));
	});

	it('set, get, and clear', async function (): Promise<void> {
		await fileDatabase.initialize();
		await fileDatabase.set(k1, v1);

		let x = fileDatabase.get(k1);
		should(x).be.equal(v1);

		await fileDatabase.clear();

		x = fileDatabase.get(k1);
		should(x).be.undefined();
	});

	it('read the file contents', async function (): Promise<void> {
		await fileDatabase.initialize();
		await fileDatabase.set(k1, v1);

		let x = fileDatabase.get(k1);
		should(x).be.equal(v1);

		await fileDatabase.shutdown();
		const data = await fs.readFile(path.join(os.tmpdir(), fileName));

		should(data.toString()).be.equal(JSON.stringify({ k1: v1 }));
	});

	it('delete prefix', async function (): Promise<void> {
		await fileDatabase.initialize();
		await Promise.all([fileDatabase.set(k1, v1), fileDatabase.set(k2, v2)]);

		let x = fileDatabase.get(k1);
		should(x).be.equal(v1);

		x = fileDatabase.get(k2);
		should(x).be.equal(v2);

		await fileDatabase.deletePrefix('k');

		x = await fileDatabase.get(k1);
		should(x).be.undefined();
	});

	it('Test write hook', async function (): Promise<void> {
		fileDatabase.setWriteHook(async (contents): Promise<string> => {
			should(contents).be.equal(JSON.stringify(fakeDB));
			return contents;
		});

		await fileDatabase.initialize();
		await fileDatabase.set(k1, v1);
		await fileDatabase.set(k2, v2);
		await fileDatabase.save();
	});

	it('Test read hook', async function (): Promise<void> {
		fileDatabase.setReadHook(async (contents): Promise<string> => {
			should(contents).be.equal(JSON.stringify(fakeDB));
			return contents;
		});
		await fs.writeFile(path.join(os.tmpdir(), fileName), JSON.stringify(fakeDB));
		await fileDatabase.initialize();
	});
});

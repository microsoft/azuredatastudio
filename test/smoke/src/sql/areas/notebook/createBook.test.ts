/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';
import { promises as fs } from 'fs';
import * as rimraf from 'rimraf';
import * as path from 'path';
import { assert } from 'console';
import * as tmp from 'tmp';

export function setup() {

	const bookName = 'my-book';

	describe('CreateBookDialog', () => {

		let tmpDir = '';
		it('can create new book with default content folder', async function () {
			const app = this.app as Application;
			await new Promise(r => setTimeout(r, 10000));
			// eslint-disable-next-line no-sync
			tmpDir = tmp.dirSync().name;
			await app.workbench.quickaccess.runCommand('Jupyter Books: Create Jupyter Book');
			await app.workbench.createBookDialog.setName(bookName);
			await app.workbench.createBookDialog.setLocation(tmpDir);
			await app.workbench.createBookDialog.create();
			const bookExists = await fs.stat(path.join(tmpDir, 'my-book'));
			assert(!!bookExists, 'Book was not created');
		});

		afterEach(async function () {
			if (tmpDir) {
				try {
					rimraf.sync(tmpDir);
				} catch (err) {
					// Try our best to clean up but don't fail the test if we can't
				}
			}
		});
	});
}

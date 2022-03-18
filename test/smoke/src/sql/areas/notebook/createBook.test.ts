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
import * as minimist from 'minimist';
import { afterSuite, beforeSuite } from '../../../utils';

const CreateBookCommand = 'Jupyter Books: Create Jupyter Book';
const bookName = 'my-book';

export function setup(opts: minimist.ParsedArgs) {
	describe('CreateBookDialog', () => {
		beforeSuite(opts);
		afterSuite(opts);

		let tmpDir = '';
		it('can create new book with default content folder', async function () {
			const app = this.app as Application;
			// eslint-disable-next-line no-sync
			tmpDir = tmp.dirSync().name;
			await app.workbench.quickaccess.runCommand(CreateBookCommand);
			await app.workbench.createBookDialog.setName(bookName);
			await app.workbench.createBookDialog.setLocation(tmpDir);
			await app.workbench.createBookDialog.create();
			const bookExists = await fs.stat(path.join(tmpDir, bookName));
			assert(!!bookExists, 'Book was not created');
			// Wait a bit for the book to load in the viewlet before ending the test, otherwise we can get an error when it tries to read the deleted files
			// TODO Instead it would be better to either not add the book to the viewlet to begin with or close it after the test is done
			await new Promise(r => setTimeout(r, 2500));
		});

		it('can create new book with specified content folder', async function () {
			const app = this.app as Application;
			// eslint-disable-next-line no-sync
			tmpDir = tmp.dirSync().name;
			// Our content folder is just the workspace folder containing the test notebooks
			const contentFolder = path.join(app.workspacePathOrFolder, 'Notebooks');
			await app.workbench.quickaccess.runCommand(CreateBookCommand);
			await app.workbench.createBookDialog.setName(bookName);
			await app.workbench.createBookDialog.setLocation(tmpDir);
			await app.workbench.createBookDialog.setContentFolder(contentFolder);
			await app.workbench.createBookDialog.create();
			const bookExists = await fs.stat(path.join(tmpDir, bookName));
			assert(!!bookExists, 'Book was not created');
			const contentNotebookExists = await fs.stat(path.join(tmpDir, bookName, 'hello.ipynb'));
			assert(!!contentNotebookExists, 'Notebook from content folder wasn\'t copied over');
			// Wait a bit for the book to load in the viewlet before ending the test, otherwise we can get an error when it tries to read the deleted files
			// TODO Instead it would be better to either not add the book to the viewlet to begin with or close it after the test is done
			await new Promise(r => setTimeout(r, 2500));
		});

		afterEach(async function () {
			if (tmpDir) {
				try {
					rimraf.sync(tmpDir);
				} catch (err) {
					// Try our best to clean up but don't fail the test if we can't
				}
			}
			const app = this.app as Application;
			// Workaround for error notification trying to read deleted books
			await app.workbench.notificationToast.closeNotificationToasts();
		});
	});
}

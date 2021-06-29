/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';
import { promises as fs } from 'fs';
import * as path from 'path';
import { assert } from 'console';

const AddRemoteBookCommand = 'Jupyter Books: Add Remote Jupyter Book';
const JUPYTER_BOOK = 'CU';
const VERSION = '1.0';
const LANGUAGE = 'EN';
export function setup() {

	describe('AddRemoteBookDialog', () => {

		it('can open remote book', async function () {
			const app = this.app as Application;
			await app.workbench.quickaccess.runCommand(AddRemoteBookCommand);
			await app.workbench.addRemoteBookDialog.setLocation('Github');
			await app.workbench.addRemoteBookDialog.setRepoUrl('repos/microsoft/tigertoolbox');
			await app.workbench.addRemoteBookDialog.search();
			await new Promise(r => setTimeout(r, 5000));
			await app.workbench.addRemoteBookDialog.setRelease('SQL Server Big Data Clusters Operational Guide');
			await new Promise(r => setTimeout(r, 5000));
			await app.workbench.addRemoteBookDialog.setJupyterBook('CU');
			await new Promise(r => setTimeout(r, 5000));
			await app.workbench.addRemoteBookDialog.setVersion('1.0');
			await new Promise(r => setTimeout(r, 5000));
			await app.workbench.addRemoteBookDialog.setLanguage('EN');

			// Wait a bit for the book to load in the viewlet before ending the test, otherwise we can get an error when it tries to read the deleted files
			// TODO Instead it would be better to either not add the book to the viewlet to begin with or close it after the test is done
			await new Promise(r => setTimeout(r, 5000));
			const bookExists = await fs.stat(path.join(app.workspacePathOrFolder, `${JUPYTER_BOOK}-${VERSION}-${LANGUAGE}`));
			assert(!!bookExists, 'Expected book was not created');
		});
	});
}

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

		it.skip('can open remote book', async function () { // Skip until the rate limit issue can be fixed
			const app = this.app as Application;
			await app.workbench.quickaccess.runCommand(AddRemoteBookCommand);
			await app.workbench.addRemoteBookDialog.setLocation('GitHub');
			await app.workbench.addRemoteBookDialog.setRepoUrl('repos/microsoft/tigertoolbox');
			await app.workbench.addRemoteBookDialog.search();
			await app.workbench.addRemoteBookDialog.setRelease('SQL Server Big Data Clusters Operational Guide');
			await app.workbench.addRemoteBookDialog.setJupyterBook(JUPYTER_BOOK);
			await app.workbench.addRemoteBookDialog.setVersion(VERSION);
			await app.workbench.addRemoteBookDialog.setLanguage(LANGUAGE);
			await app.workbench.addRemoteBookDialog.add();
			const bookExists = await fs.stat(path.join(app.workspacePathOrFolder, `${JUPYTER_BOOK}-${VERSION}-${LANGUAGE}`));
			assert(!!bookExists, 'Expected book was not created');
		});
	});
}

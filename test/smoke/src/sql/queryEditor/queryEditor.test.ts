/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../application';
import { allExtensionsLoadedText } from '../../main';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function setup() {
	describe('Query Editor Test Suite', () => {
		before(async function () {
			// Wait for all extensions to load. This is to prevent a race condition where some extensions
			// were downloading additional resources and sending messages for that to the output window,
			// which was grabbing focus from the text area. If this happened while the text in the tests
			// was being typed then it would not be able to finish typing the text and thus the test would
			// fail.
			const app = this.app as Application;
			await app.workbench.statusbar.waitForStatusbarText(allExtensionsLoadedText, allExtensionsLoadedText);
		});

		it('Can open and edit existing file', async function () {
			const testFilePath = path.join(os.tmpdir(), 'QueryEditorSmokeTest.sql');
			fs.writeFileSync(testFilePath, '');
			try {
				const app = this.app as Application;
				await app.workbench.queryEditors.openFile(testFilePath);
				const fileBaseName = path.basename(testFilePath);
				await app.workbench.editor.waitForTypeInEditor(fileBaseName, 'SELECT * FROM sys.tables');
			}
			finally {
				fs.unlinkSync(testFilePath);
			}
		});
	});
}
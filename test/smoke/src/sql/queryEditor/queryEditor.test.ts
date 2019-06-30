/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../application';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function setup() {
	describe('Query Editor Test Suite', () => {
		it('Can open and edit existing file', async function () {
			const testFilePath = path.join(os.tmpdir(), 'QueryEditorSmokeTest.sql');
			fs.writeFileSync(testFilePath, '');
			try {
				const app = this.app as Application;
				await app.workbench.queryEditors.openFile(testFilePath);
				const fileBaseName = path.basename(testFilePath);
				// The output window is sometimes taking focus from the query window so make sure we have focus before trying to type the text
				await app.workbench.editor.waitForEditorFocus(fileBaseName, 1);
				await app.workbench.editor.waitForTypeInEditor(fileBaseName, 'SELECT * FROM sys.tables');
			}
			finally {
				fs.unlinkSync(testFilePath);
			}
		});
	});
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';

export function setup() {
	describe('Query Editor', () => {

		it('can open and connect file', async function () {
			const app = this.app as Application;
			await app.workbench.quickaccess.openFile('test.sql');
			await app.workbench.queryEditor.commandBar.clickButton(3);
			await app.workbench.connectionDialog.waitForConnectionDialog();
			await app.code.waitForSetValue('.modal .modal-body select[aria-label="Connection type"]', 'Sqlite');
			await app.code.waitForSetValue('.modal .modal-body input[aria-label="File"]', 'chinook.db');
			await app.code.waitAndClick('.modal .modal-footer a[aria-label="Connect"]');
			await app.workbench.queryEditor.commandBar.waitForButton(3, 'Disconnect');
		});
	});
}

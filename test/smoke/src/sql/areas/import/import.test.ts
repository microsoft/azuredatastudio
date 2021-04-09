/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';

export function setup() {
	describe('Import', () => {

		it('Opening import wizard without connection opens connection dialog', async function () {
			const app = this.app as Application;
			await app.workbench.quickaccess.runCommand('flatFileImport.start');
			// Wait for the service to be downloaded and installed
			await app.workbench.statusbar.waitForStatusbarText('', 'Flat File Import Service Started', 5 * 60 * 10);
			await app.workbench.connectionDialog.waitForConnectionDialog();
		});
	});
}

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
			await app.workbench.connectionDialog.waitForConnectionDialog();
		});
	});
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';
import * as minimist from 'minimist';
import { afterSuite, beforeSuite } from '../../../utils';

export function setup(opts: minimist.ParsedArgs) {
	describe('Import', () => {
		beforeSuite(opts);
		afterSuite(opts);

		it('Opening import wizard without connection opens connection dialog', async function () {
			const app = this.app as Application;
			await app.workbench.quickaccess.runCommand('Flat File Import: Import Wizard');
			// Wait for the service to be downloaded and installed. This can take a while so set timeout to 5min (retryInterval default is 100ms)
			await app.workbench.statusbar.waitForStatusbarText('Microsoft.import', 'Flat File Import Service Started', 5 * 60 * 10);
			await app.workbench.connectionDialog.waitForConnectionDialog();
		});
	});
}

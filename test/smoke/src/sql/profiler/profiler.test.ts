/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../application';

export function setup() {
	describe('Profiler', () => {
		it('Launch profiler', async function () {
			const app = this.app as Application;
			await app.workbench.profiler.launchProfiler();
			await app.workbench.connectionDialog.waitForConnectionDialog();
			await app.workbench.connectionDialog.connect({ ServerName: 'sqltools2017-3' });
			await app.workbench.profiler.waitForNewSessionDialogAndStart();
			await new Promise(c => setTimeout(c, 10000));
		});
	});
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application, getStandaloneServer } from '../../../../automation';

export function setup() {
	describe('profiler test suite', () => {
		it('Launch profiler test', async function () {
			const app = this.app as Application;
			await app.workbench.profiler.launchProfiler();
			await app.workbench.connectionDialog.waitForConnectionDialog();
			await app.workbench.connectionDialog.connect(await getStandaloneServer());
			await app.workbench.profiler.waitForNewSessionDialogAndStart();
		});
	});
}

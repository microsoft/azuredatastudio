/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application, Logger } from '../../../../automation';
import { installAllHandlers } from '../../utils';

export function setup(logger: Logger) {
	describe.skip('Extensions', () => {

		// Shared before/after handling
		installAllHandlers(logger);

		it('install and enable vscode-smoketest-check extension', async function () {
			const app = this.app as Application;

			await app.workbench.extensions.openExtensionsViewlet();
			await app.workbench.extensions.installExtension('ms-vscode.vscode-smoketest-check', true);

			// Close extension editor because keybindings dispatch is not working when web views are opened and focused
			// https://github.com/microsoft/vscode/issues/110276
			await app.workbench.extensions.closeExtension('vscode-smoketest-check');

			await app.workbench.quickaccess.runCommand('Smoke Test Check');
		});
	});
}

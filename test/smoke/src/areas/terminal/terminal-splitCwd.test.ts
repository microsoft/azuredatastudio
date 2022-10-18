/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application, Terminal } from '../../../../automation';

export function setup() {
	describe('Terminal splitCwd', () => {
		// Acquire automation API
		let terminal: Terminal;
		before(async function () {
			const app = this.app as Application;
			terminal = app.workbench.terminal;
			await app.workbench.settingsEditor.addUserSetting('terminal.integrated.splitCwd', '"inherited"');
			await app.workbench.quickaccess.runCommand('workbench.action.closeAllEditors');
		});

		it('should inherit cwd when split and update the tab description - alt click', async () => {
			await terminal.createTerminal();
			const cwd = 'test';
			await terminal.runCommandInTerminal(`mkdir ${cwd}`);
			await terminal.runCommandInTerminal(`cd ${cwd}`);
			const page = await terminal.getPage();
			page.keyboard.down('Alt');
			await terminal.clickSingleTab();
			page.keyboard.up('Alt');
			await terminal.assertTerminalGroups([[{ description: cwd }, { description: cwd }]]);
		});
	});
}

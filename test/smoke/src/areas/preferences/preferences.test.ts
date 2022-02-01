/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import minimist = require('minimist');
import { Application, ActivityBarPosition } from '../../../../automation';
import { afterSuite, beforeSuite } from '../../utils';

export function setup(opts: minimist.ParsedArgs) {
	describe('Preferences', () => {
		beforeSuite(opts);
		afterSuite(opts);

		it('turns off editor line numbers and verifies the live change', async function () {
			const app = this.app as Application;

			await app.workbench.quickaccess.openFile('app.js');
			await app.code.waitForElements('.line-numbers', false, elements => !!elements.length);

			await app.workbench.settingsEditor.addUserSetting('editor.lineNumbers', '"off"');
			await app.workbench.editors.selectTab('app.js');
			await app.code.waitForElements('.line-numbers', false, result => !result || result.length === 0);
		});

		it(`changes 'workbench.action.toggleSidebarPosition' command key binding and verifies it`, async function () {
			const app = this.app as Application;
			await app.workbench.activitybar.waitForActivityBar(ActivityBarPosition.LEFT);

			await app.workbench.keybindingsEditor.updateKeybinding('workbench.action.toggleSidebarPosition', 'View: Toggle Side Bar Position', 'ctrl+u', 'Control+U');

			await app.code.dispatchKeybinding('ctrl+u');
			await app.workbench.activitybar.waitForActivityBar(ActivityBarPosition.RIGHT);
		});
	});
}

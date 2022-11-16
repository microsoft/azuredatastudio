/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application, Terminal, SettingsEditor } from '../../../../automation';

export function setup() {
	describe('Terminal Input', () => {
		let terminal: Terminal;
		let settingsEditor: SettingsEditor;

		// Acquire automation API
		before(async function () {
			const app = this.app as Application;
			terminal = app.workbench.terminal;
			settingsEditor = app.workbench.settingsEditor;
		});

		describe('Auto replies', function () {

			// HACK: Retry this suite only on Windows because conpty can rarely lead to unexpected behavior which would
			// cause flakiness. If this does happen, the feature is expected to fail.
			if (process.platform === 'win32') {
				this.retries(3);
			}

			async function writeTextForAutoReply(text: string): Promise<void> {
				// Put the matching word in quotes to avoid powershell coloring the first word and
				// on a new line to avoid cursor move/line switching sequences
				await terminal.runCommandInTerminal(`"\r${text}`, true);
			}

			it.skip('should automatically reply to default "Terminate batch job (Y/N)"', async () => { // TODO: #139076
				await terminal.createTerminal();
				await writeTextForAutoReply('Terminate batch job (Y/N)?');
				await terminal.waitForTerminalText(buffer => buffer.some(line => line.match(/\?.*Y/)));
			});

			it('should automatically reply to a custom entry', async () => {
				await settingsEditor.addUserSetting('terminal.integrated.autoReplies', '{ "foo": "bar" }');
				await terminal.createTerminal();
				await writeTextForAutoReply('foo');
				await terminal.waitForTerminalText(buffer => buffer.some(line => line.match(/foo.*bar/)));
			});
		});
	});
}

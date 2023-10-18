/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Terminal } from 'xterm';
import { LineDataEventAddon } from 'vs/workbench/contrib/terminal/browser/xterm/lineDataEventAddon';
import { OperatingSystem } from 'vs/base/common/platform';
import { deepStrictEqual } from 'assert';
import { importAMDNodeModule } from 'vs/amdX';
import { writeP } from 'vs/workbench/contrib/terminal/browser/terminalTestHelpers';

suite('LineDataEventAddon', () => {
	let xterm: Terminal;
	let lineDataEventAddon: LineDataEventAddon;

	suite('onLineData', () => {
		let events: string[];

		setup(async () => {
			const TerminalCtor = (await importAMDNodeModule<typeof import('xterm')>('xterm', 'lib/xterm.js')).Terminal;
			xterm = new TerminalCtor({ allowProposedApi: true, cols: 4 });
			lineDataEventAddon = new LineDataEventAddon();
			xterm.loadAddon(lineDataEventAddon);

			events = [];
			lineDataEventAddon.onLineData(e => events.push(e));
		});

		test('should fire when a non-wrapped line ends with a line feed', async () => {
			await writeP(xterm, 'foo');
			deepStrictEqual(events, []);
			await writeP(xterm, '\n\r');
			deepStrictEqual(events, ['foo']);
			await writeP(xterm, 'bar');
			deepStrictEqual(events, ['foo']);
			await writeP(xterm, '\n');
			deepStrictEqual(events, ['foo', 'bar']);
		});

		test('should not fire soft wrapped lines', async () => {
			await writeP(xterm, 'foo.');
			deepStrictEqual(events, []);
			await writeP(xterm, 'bar.');
			deepStrictEqual(events, []);
			await writeP(xterm, 'baz.');
			deepStrictEqual(events, []);
		});

		test('should fire when a wrapped line ends with a line feed', async () => {
			await writeP(xterm, 'foo.bar.baz.');
			deepStrictEqual(events, []);
			await writeP(xterm, '\n\r');
			deepStrictEqual(events, ['foo.bar.baz.']);
		});

		test('should not fire on cursor move when the backing process is not on Windows', async () => {
			await writeP(xterm, 'foo.\x1b[H');
			deepStrictEqual(events, []);
		});

		test('should fire on cursor move when the backing process is on Windows', async () => {
			lineDataEventAddon.setOperatingSystem(OperatingSystem.Windows);
			await writeP(xterm, 'foo\x1b[H');
			deepStrictEqual(events, ['foo']);
		});
	});
});

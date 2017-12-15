/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { KeyMod, KeyCode, createKeybinding, KeyChord, SimpleKeybinding } from 'vs/base/common/keyCodes';
import { OperatingSystem } from 'vs/base/common/platform';
import { IResolvedKeybinding, assertResolveKeybinding, assertResolveKeyboardEvent, assertResolveUserBinding } from 'vs/workbench/services/keybinding/test/keyboardMapperTestUtils';
import { MacLinuxFallbackKeyboardMapper } from 'vs/workbench/services/keybinding/common/macLinuxFallbackKeyboardMapper';
import { ScanCodeBinding, ScanCode } from 'vs/workbench/services/keybinding/common/scanCode';

suite('keyboardMapper - MAC fallback', () => {

	//let mapper = new MacLinuxFallbackKeyboardMapper(OperatingSystem.Macintosh);

	// function _assertResolveKeybinding(k: number, expected: IResolvedKeybinding[]): void {
	// 	assertResolveKeybinding(mapper, createKeybinding(k, OperatingSystem.Macintosh), expected);
	// }

	test('resolveKeybinding Cmd+Z', () => {
		// _assertResolveKeybinding(
		// 	KeyMod.CtrlCmd | KeyCode.KEY_Z,
		// 	[{
		// 		label: '⌘Z',
		// 		ariaLabel: 'Command+Z',
		// 		electronAccelerator: 'Cmd+Z',
		// 		userSettingsLabel: 'cmd+z',
		// 		isWYSIWYG: true,
		// 		isChord: false,
		// 		dispatchParts: ['meta+Z', null],
		// 	}]
		// );
	});
});

suite('keyboardMapper - LINUX fallback', () => {

	//let mapper = new MacLinuxFallbackKeyboardMapper(OperatingSystem.Linux);

	// function _assertResolveKeybinding(k: number, expected: IResolvedKeybinding[]): void {
	// 	assertResolveKeybinding(mapper, createKeybinding(k, OperatingSystem.Linux), expected);
	// }

	test('resolveKeybinding Ctrl+Z', () => {
		// _assertResolveKeybinding(
		// 	KeyMod.CtrlCmd | KeyCode.KEY_Z,
		// 	[{
		// 		label: 'Ctrl+Z',
		// 		ariaLabel: 'Control+Z',
		// 		electronAccelerator: 'Ctrl+Z',
		// 		userSettingsLabel: 'ctrl+z',
		// 		isWYSIWYG: true,
		// 		isChord: false,
		// 		dispatchParts: ['ctrl+Z', null],
		// 	}]
		// );
	});
});

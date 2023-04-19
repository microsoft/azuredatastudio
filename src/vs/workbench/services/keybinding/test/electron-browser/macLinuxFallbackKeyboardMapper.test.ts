/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyChord, KeyCode, KeyMod, ScanCode } from 'vs/base/common/keyCodes';
import { SimpleKeybinding, createKeybinding, ScanCodeBinding } from 'vs/base/common/keybindings';
import { OperatingSystem } from 'vs/base/common/platform';
import { MacLinuxFallbackKeyboardMapper } from 'vs/workbench/services/keybinding/common/macLinuxFallbackKeyboardMapper';
import { IResolvedKeybinding, assertResolveKeybinding, assertResolveKeyboardEvent, assertResolveUserBinding } from 'vs/workbench/services/keybinding/test/electron-browser/keyboardMapperTestUtils';

suite('keyboardMapper - MAC fallback', () => {

	let mapper = new MacLinuxFallbackKeyboardMapper(OperatingSystem.Macintosh);

	function _assertResolveKeybinding(k: number, expected: IResolvedKeybinding[]): void {
		assertResolveKeybinding(mapper, createKeybinding(k, OperatingSystem.Macintosh)!, expected);
	}

	test('resolveKeybinding Cmd+Z', () => {
		_assertResolveKeybinding(
			KeyMod.CtrlCmd | KeyCode.KeyZ,
			[{
				label: '⌘Z',
				ariaLabel: 'Command+Z',
				electronAccelerator: 'Cmd+Z',
				userSettingsLabel: 'cmd+z',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: ['meta+Z'],
				singleModifierDispatchParts: [null],
			}]
		);
	});

	test('resolveKeybinding Cmd+K Cmd+=', () => {
		_assertResolveKeybinding(
			KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Equal),
			[{
				label: '⌘K ⌘=',
				ariaLabel: 'Command+K Command+=',
				electronAccelerator: null,
				userSettingsLabel: 'cmd+k cmd+=',
				isWYSIWYG: true,
				isChord: true,
				dispatchParts: ['meta+K', 'meta+='],
				singleModifierDispatchParts: [null, null],
			}]
		);
	});

	test('resolveKeyboardEvent Cmd+Z', () => {
		assertResolveKeyboardEvent(
			mapper,
			{
				_standardKeyboardEventBrand: true,
				ctrlKey: false,
				shiftKey: false,
				altKey: false,
				metaKey: true,
				keyCode: KeyCode.KeyZ,
				code: null!
			},
			{
				label: '⌘Z',
				ariaLabel: 'Command+Z',
				electronAccelerator: 'Cmd+Z',
				userSettingsLabel: 'cmd+z',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: ['meta+Z'],
				singleModifierDispatchParts: [null],
			}
		);
	});

	test('resolveUserBinding empty', () => {
		assertResolveUserBinding(mapper, [], []);
	});

	test('resolveUserBinding Cmd+[Comma] Cmd+/', () => {
		assertResolveUserBinding(
			mapper, [
			new ScanCodeBinding(false, false, false, true, ScanCode.Comma),
			new SimpleKeybinding(false, false, false, true, KeyCode.Slash),
		],
			[{
				label: '⌘, ⌘/',
				ariaLabel: 'Command+, Command+/',
				electronAccelerator: null,
				userSettingsLabel: 'cmd+, cmd+/',
				isWYSIWYG: true,
				isChord: true,
				dispatchParts: ['meta+,', 'meta+/'],
				singleModifierDispatchParts: [null, null],
			}]
		);
	});

	test('resolveKeyboardEvent Single Modifier Meta+', () => {
		assertResolveKeyboardEvent(
			mapper,
			{
				_standardKeyboardEventBrand: true,
				ctrlKey: false,
				shiftKey: false,
				altKey: false,
				metaKey: true,
				keyCode: KeyCode.Meta,
				code: null!
			},
			{
				label: '⌘',
				ariaLabel: 'Command',
				electronAccelerator: null,
				userSettingsLabel: 'cmd',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: [null],
				singleModifierDispatchParts: ['meta'],
			}
		);
	});

	test('resolveKeyboardEvent Single Modifier Shift+', () => {
		assertResolveKeyboardEvent(
			mapper,
			{
				_standardKeyboardEventBrand: true,
				ctrlKey: false,
				shiftKey: true,
				altKey: false,
				metaKey: false,
				keyCode: KeyCode.Shift,
				code: null!
			},
			{
				label: '⇧',
				ariaLabel: 'Shift',
				electronAccelerator: null,
				userSettingsLabel: 'shift',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: [null],
				singleModifierDispatchParts: ['shift'],
			}
		);
	});

	test('resolveKeyboardEvent Single Modifier Alt+', () => {
		assertResolveKeyboardEvent(
			mapper,
			{
				_standardKeyboardEventBrand: true,
				ctrlKey: false,
				shiftKey: false,
				altKey: true,
				metaKey: false,
				keyCode: KeyCode.Alt,
				code: null!
			},
			{
				label: '⌥',
				ariaLabel: 'Option',
				electronAccelerator: null,
				userSettingsLabel: 'alt',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: [null],
				singleModifierDispatchParts: ['alt'],
			}
		);
	});

	test('resolveKeyboardEvent Single Modifier Meta+', () => {
		assertResolveKeyboardEvent(
			mapper,
			{
				_standardKeyboardEventBrand: true,
				ctrlKey: false,
				shiftKey: false,
				altKey: false,
				metaKey: true,
				keyCode: KeyCode.Meta,
				code: null!
			},
			{
				label: '⌘',
				ariaLabel: 'Command',
				electronAccelerator: null,
				userSettingsLabel: 'cmd',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: [null],
				singleModifierDispatchParts: ['meta'],
			}
		);
	});

	test('resolveKeyboardEvent Only Modifiers Ctrl+Shift+', () => {
		assertResolveKeyboardEvent(
			mapper,
			{
				_standardKeyboardEventBrand: true,
				ctrlKey: true,
				shiftKey: true,
				altKey: false,
				metaKey: false,
				keyCode: KeyCode.Shift,
				code: null!
			},
			{
				label: '⌃⇧',
				ariaLabel: 'Control+Shift',
				electronAccelerator: null,
				userSettingsLabel: 'ctrl+shift',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: [null],
				singleModifierDispatchParts: [null],
			}
		);
	});
});

suite('keyboardMapper - LINUX fallback', () => {

	let mapper = new MacLinuxFallbackKeyboardMapper(OperatingSystem.Linux);

	function _assertResolveKeybinding(k: number, expected: IResolvedKeybinding[]): void {
		assertResolveKeybinding(mapper, createKeybinding(k, OperatingSystem.Linux)!, expected);
	}

	test('resolveKeybinding Ctrl+Z', () => {
		_assertResolveKeybinding(
			KeyMod.CtrlCmd | KeyCode.KeyZ,
			[{
				label: 'Ctrl+Z',
				ariaLabel: 'Control+Z',
				electronAccelerator: 'Ctrl+Z',
				userSettingsLabel: 'ctrl+z',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: ['ctrl+Z'],
				singleModifierDispatchParts: [null],
			}]
		);
	});

	test('resolveKeybinding Ctrl+K Ctrl+=', () => {
		_assertResolveKeybinding(
			KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Equal),
			[{
				label: 'Ctrl+K Ctrl+=',
				ariaLabel: 'Control+K Control+=',
				electronAccelerator: null,
				userSettingsLabel: 'ctrl+k ctrl+=',
				isWYSIWYG: true,
				isChord: true,
				dispatchParts: ['ctrl+K', 'ctrl+='],
				singleModifierDispatchParts: [null, null],
			}]
		);
	});

	test('resolveKeyboardEvent Ctrl+Z', () => {
		assertResolveKeyboardEvent(
			mapper,
			{
				_standardKeyboardEventBrand: true,
				ctrlKey: true,
				shiftKey: false,
				altKey: false,
				metaKey: false,
				keyCode: KeyCode.KeyZ,
				code: null!
			},
			{
				label: 'Ctrl+Z',
				ariaLabel: 'Control+Z',
				electronAccelerator: 'Ctrl+Z',
				userSettingsLabel: 'ctrl+z',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: ['ctrl+Z'],
				singleModifierDispatchParts: [null],
			}
		);
	});

	test('resolveUserBinding Ctrl+[Comma] Ctrl+/', () => {
		assertResolveUserBinding(
			mapper, [
			new ScanCodeBinding(true, false, false, false, ScanCode.Comma),
			new SimpleKeybinding(true, false, false, false, KeyCode.Slash),
		],
			[{
				label: 'Ctrl+, Ctrl+/',
				ariaLabel: 'Control+, Control+/',
				electronAccelerator: null,
				userSettingsLabel: 'ctrl+, ctrl+/',
				isWYSIWYG: true,
				isChord: true,
				dispatchParts: ['ctrl+,', 'ctrl+/'],
				singleModifierDispatchParts: [null, null],
			}]
		);
	});

	test('resolveUserBinding Ctrl+[Comma]', () => {
		assertResolveUserBinding(
			mapper, [
			new ScanCodeBinding(true, false, false, false, ScanCode.Comma),
		],
			[{
				label: 'Ctrl+,',
				ariaLabel: 'Control+,',
				electronAccelerator: 'Ctrl+,',
				userSettingsLabel: 'ctrl+,',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: ['ctrl+,'],
				singleModifierDispatchParts: [null],
			}]
		);
	});

	test('resolveKeyboardEvent Single Modifier Ctrl+', () => {
		assertResolveKeyboardEvent(
			mapper,
			{
				_standardKeyboardEventBrand: true,
				ctrlKey: true,
				shiftKey: false,
				altKey: false,
				metaKey: false,
				keyCode: KeyCode.Ctrl,
				code: null!
			},
			{
				label: 'Ctrl',
				ariaLabel: 'Control',
				electronAccelerator: null,
				userSettingsLabel: 'ctrl',
				isWYSIWYG: true,
				isChord: false,
				dispatchParts: [null],
				singleModifierDispatchParts: ['ctrl'],
			}
		);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyboardLayoutContribution } from 'vs/workbench/services/keybinding/browser/keyboardLayouts/_.contribution';


KeyboardLayoutContribution.INSTANCE.registerKeyboardLayout({
	layout: { name: '0000041D', id: '', text: 'Swedish' },
	secondaryLayouts: [
		{ name: '0000040B', id: '', text: 'Finnish' }
	],
	mapping: {
		Sleep: [],
		WakeUp: [],
		KeyA: ['a', 'A', '', '', 0, 'VK_A'],
		KeyB: ['b', 'B', '', '', 0, 'VK_B'],
		KeyC: ['c', 'C', '', '', 0, 'VK_C'],
		KeyD: ['d', 'D', '', '', 0, 'VK_D'],
		KeyE: ['e', 'E', '€', '', 0, 'VK_E'],
		KeyF: ['f', 'F', '', '', 0, 'VK_F'],
		KeyG: ['g', 'G', '', '', 0, 'VK_G'],
		KeyH: ['h', 'H', '', '', 0, 'VK_H'],
		KeyI: ['i', 'I', '', '', 0, 'VK_I'],
		KeyJ: ['j', 'J', '', '', 0, 'VK_J'],
		KeyK: ['k', 'K', '', '', 0, 'VK_K'],
		KeyL: ['l', 'L', '', '', 0, 'VK_L'],
		KeyM: ['m', 'M', 'µ', '', 0, 'VK_M'],
		KeyN: ['n', 'N', '', '', 0, 'VK_N'],
		KeyO: ['o', 'O', '', '', 0, 'VK_O'],
		KeyP: ['p', 'P', '', '', 0, 'VK_P'],
		KeyQ: ['q', 'Q', '', '', 0, 'VK_Q'],
		KeyR: ['r', 'R', '', '', 0, 'VK_R'],
		KeyS: ['s', 'S', '', '', 0, 'VK_S'],
		KeyT: ['t', 'T', '', '', 0, 'VK_T'],
		KeyU: ['u', 'U', '', '', 0, 'VK_U'],
		KeyV: ['v', 'V', '', '', 0, 'VK_V'],
		KeyW: ['w', 'W', '', '', 0, 'VK_W'],
		KeyX: ['x', 'X', '', '', 0, 'VK_X'],
		KeyY: ['y', 'Y', '', '', 0, 'VK_Y'],
		KeyZ: ['z', 'Z', '', '', 0, 'VK_Z'],
		Digit1: ['1', '!', '', '', 0, 'VK_1'],
		Digit2: ['2', '"', '@', '', 0, 'VK_2'],
		Digit3: ['3', '#', '£', '', 0, 'VK_3'],
		Digit4: ['4', '¤', '$', '', 0, 'VK_4'],
		Digit5: ['5', '%', '€', '', 0, 'VK_5'],
		Digit6: ['6', '&', '', '', 0, 'VK_6'],
		Digit7: ['7', '/', '{', '', 0, 'VK_7'],
		Digit8: ['8', '(', '[', '', 0, 'VK_8'],
		Digit9: ['9', ')', ']', '', 0, 'VK_9'],
		Digit0: ['0', '=', '}', '', 0, 'VK_0'],
		Enter: [],
		Escape: [],
		Backspace: [],
		Tab: [],
		Space: [' ', ' ', '', '', 0, 'VK_SPACE'],
		Minus: ['+', '?', '\\', '', 0, 'VK_OEM_PLUS'],
		Equal: ['´', '`', '', '', 0, 'VK_OEM_4'],
		BracketLeft: ['å', 'Å', '', '', 0, 'VK_OEM_6'],
		BracketRight: ['¨', '^', '~', '', 0, 'VK_OEM_1'],
		Backslash: ['\'', '*', '', '', 0, 'VK_OEM_2'],
		Semicolon: ['ö', 'Ö', '', '', 0, 'VK_OEM_3'],
		Quote: ['ä', 'Ä', '', '', 0, 'VK_OEM_7'],
		Backquote: ['§', '½', '', '', 0, 'VK_OEM_5'],
		Comma: [',', ';', '', '', 0, 'VK_OEM_COMMA'],
		Period: ['.', ':', '', '', 0, 'VK_OEM_PERIOD'],
		Slash: ['-', '_', '', '', 0, 'VK_OEM_MINUS'],
		CapsLock: [],
		F1: [],
		F2: [],
		F3: [],
		F4: [],
		F5: [],
		F6: [],
		F7: [],
		F8: [],
		F9: [],
		F10: [],
		F11: [],
		F12: [],
		PrintScreen: [],
		ScrollLock: [],
		Pause: [],
		Insert: [],
		Home: [],
		PageUp: [],
		Delete: [],
		End: [],
		PageDown: [],
		ArrowRight: [],
		ArrowLeft: [],
		ArrowDown: [],
		ArrowUp: [],
		NumLock: [],
		NumpadDivide: ['/', '/', '', '', 0, 'VK_DIVIDE'],
		NumpadMultiply: ['*', '*', '', '', 0, 'VK_MULTIPLY'],
		NumpadSubtract: ['-', '-', '', '', 0, 'VK_SUBTRACT'],
		NumpadAdd: ['+', '+', '', '', 0, 'VK_ADD'],
		NumpadEnter: [],
		Numpad1: [],
		Numpad2: [],
		Numpad3: [],
		Numpad4: [],
		Numpad5: [],
		Numpad6: [],
		Numpad7: [],
		Numpad8: [],
		Numpad9: [],
		Numpad0: [],
		NumpadDecimal: [],
		IntlBackslash: ['<', '>', '|', '', 0, 'VK_OEM_102'],
		ContextMenu: [],
		Power: [],
		NumpadEqual: [],
		F13: [],
		F14: [],
		F15: [],
		F16: [],
		F17: [],
		F18: [],
		F19: [],
		F20: [],
		F21: [],
		F22: [],
		F23: [],
		F24: [],
		Help: [],
		Undo: [],
		Cut: [],
		Copy: [],
		Paste: [],
		AudioVolumeMute: [],
		AudioVolumeUp: [],
		AudioVolumeDown: [],
		NumpadComma: [],
		IntlRo: [],
		KanaMode: [],
		IntlYen: [],
		Convert: [],
		NonConvert: [],
		Lang1: [],
		Lang2: [],
		Lang3: [],
		Lang4: [],
		ControlLeft: [],
		ShiftLeft: [],
		AltLeft: [],
		MetaLeft: [],
		ControlRight: [],
		ShiftRight: [],
		AltRight: [],
		MetaRight: [],
		MediaTrackNext: [],
		MediaTrackPrevious: [],
		MediaStop: [],
		Eject: [],
		MediaPlayPause: [],
		MediaSelect: [],
		LaunchMail: [],
		LaunchApp2: [],
		LaunchApp1: [],
		BrowserSearch: [],
		BrowserHome: [],
		BrowserBack: [],
		BrowserForward: [],
		BrowserStop: [],
		BrowserRefresh: [],
		BrowserFavorites: []
	}
});

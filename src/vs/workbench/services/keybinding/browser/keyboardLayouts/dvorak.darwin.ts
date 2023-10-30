/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyboardLayoutContribution } from 'vs/workbench/services/keybinding/browser/keyboardLayouts/_.contribution';

KeyboardLayoutContribution.INSTANCE.registerKeyboardLayout({
	layout: { id: 'com.apple.keylayout.Dvorak', localizedName: 'Dvorak', lang: 'en' },
	secondaryLayouts: [],
	mapping: {
		KeyA: ['a', 'A', 'å', 'Å', 0],
		KeyB: ['x', 'X', '≈', '˛', 0],
		KeyC: ['j', 'J', '∆', 'Ô', 0],
		KeyD: ['e', 'E', '´', '´', 4],
		KeyE: ['.', '>', '≥', '˘', 0],
		KeyF: ['u', 'U', '¨', '¨', 4],
		KeyG: ['i', 'I', 'ˆ', 'ˆ', 4],
		KeyH: ['d', 'D', '∂', 'Î', 0],
		KeyI: ['c', 'C', 'ç', 'Ç', 0],
		KeyJ: ['h', 'H', '˙', 'Ó', 0],
		KeyK: ['t', 'T', '†', 'ˇ', 0],
		KeyL: ['n', 'N', '˜', '˜', 4],
		KeyM: ['m', 'M', 'µ', 'Â', 0],
		KeyN: ['b', 'B', '∫', 'ı', 0],
		KeyO: ['r', 'R', '®', '‰', 0],
		KeyP: ['l', 'L', '¬', 'Ò', 0],
		KeyQ: ['\'', '"', 'æ', 'Æ', 0],
		KeyR: ['p', 'P', 'π', '∏', 0],
		KeyS: ['o', 'O', 'ø', 'Ø', 0],
		KeyT: ['y', 'Y', '¥', 'Á', 0],
		KeyU: ['g', 'G', '©', '˝', 0],
		KeyV: ['k', 'K', '˚', '', 0],
		KeyW: [',', '<', '≤', '¯', 0],
		KeyX: ['q', 'Q', 'œ', 'Œ', 0],
		KeyY: ['f', 'F', 'ƒ', 'Ï', 0],
		KeyZ: [';', ':', '…', 'Ú', 0],
		Digit1: ['1', '!', '¡', '⁄', 0],
		Digit2: ['2', '@', '™', '€', 0],
		Digit3: ['3', '#', '£', '‹', 0],
		Digit4: ['4', '$', '¢', '›', 0],
		Digit5: ['5', '%', '∞', 'ﬁ', 0],
		Digit6: ['6', '^', '§', 'ﬂ', 0],
		Digit7: ['7', '&', '¶', '‡', 0],
		Digit8: ['8', '*', '•', '°', 0],
		Digit9: ['9', '(', 'ª', '·', 0],
		Digit0: ['0', ')', 'º', '‚', 0],
		Enter: [],
		Escape: [],
		Backspace: [],
		Tab: [],
		Space: [' ', ' ', ' ', ' ', 0],
		Minus: ['[', '{', '“', '”', 0],
		Equal: [']', '}', '‘', '’', 0],
		BracketLeft: ['/', '?', '÷', '¿', 0],
		BracketRight: ['=', '+', '≠', '±', 0],
		Backslash: ['\\', '|', '«', '»', 0],
		Semicolon: ['s', 'S', 'ß', 'Í', 0],
		Quote: ['-', '_', '–', '—', 0],
		Backquote: ['`', '~', '`', '`', 4],
		Comma: ['w', 'W', '∑', '„', 0],
		Period: ['v', 'V', '√', '◊', 0],
		Slash: ['z', 'Z', 'Ω', '¸', 0],
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
		NumpadDivide: ['/', '/', '/', '/', 0],
		NumpadMultiply: ['*', '*', '*', '*', 0],
		NumpadSubtract: ['-', '-', '-', '-', 0],
		NumpadAdd: ['+', '+', '+', '+', 0],
		NumpadEnter: [],
		Numpad1: ['1', '1', '1', '1', 0],
		Numpad2: ['2', '2', '2', '2', 0],
		Numpad3: ['3', '3', '3', '3', 0],
		Numpad4: ['4', '4', '4', '4', 0],
		Numpad5: ['5', '5', '5', '5', 0],
		Numpad6: ['6', '6', '6', '6', 0],
		Numpad7: ['7', '7', '7', '7', 0],
		Numpad8: ['8', '8', '8', '8', 0],
		Numpad9: ['9', '9', '9', '9', 0],
		Numpad0: ['0', '0', '0', '0', 0],
		NumpadDecimal: ['.', '.', '.', '.', 0],
		IntlBackslash: ['§', '±', '§', '±', 0],
		ContextMenu: [],
		NumpadEqual: ['=', '=', '=', '=', 0],
		F13: [],
		F14: [],
		F15: [],
		F16: [],
		F17: [],
		F18: [],
		F19: [],
		F20: [],
		AudioVolumeMute: [],
		AudioVolumeUp: ['', '=', '', '=', 0],
		AudioVolumeDown: [],
		NumpadComma: [],
		IntlRo: [],
		KanaMode: [],
		IntlYen: [],
		ControlLeft: [],
		ShiftLeft: [],
		AltLeft: [],
		MetaLeft: [],
		ControlRight: [],
		ShiftRight: [],
		AltRight: [],
		MetaRight: []
	}
});

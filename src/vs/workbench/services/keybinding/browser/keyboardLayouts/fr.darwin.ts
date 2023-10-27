/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyboardLayoutContribution } from 'vs/workbench/services/keybinding/browser/keyboardLayouts/_.contribution';


KeyboardLayoutContribution.INSTANCE.registerKeyboardLayout({
	layout: { id: 'com.apple.keylayout.French', lang: 'fr', localizedName: 'French' },
	secondaryLayouts: [],
	mapping: {
		KeyA: ['q', 'Q', '‡', 'Ω', 0],
		KeyB: ['b', 'B', 'ß', '∫', 0],
		KeyC: ['c', 'C', '©', '¢', 0],
		KeyD: ['d', 'D', '∂', '∆', 0],
		KeyE: ['e', 'E', 'ê', 'Ê', 0],
		KeyF: ['f', 'F', 'ƒ', '·', 0],
		KeyG: ['g', 'G', 'ﬁ', 'ﬂ', 0],
		KeyH: ['h', 'H', 'Ì', 'Î', 0],
		KeyI: ['i', 'I', 'î', 'ï', 0],
		KeyJ: ['j', 'J', 'Ï', 'Í', 0],
		KeyK: ['k', 'K', 'È', 'Ë', 0],
		KeyL: ['l', 'L', '¬', '|', 0],
		KeyM: [',', '?', '∞', '¿', 0],
		KeyN: ['n', 'N', '~', 'ı', 4],
		KeyO: ['o', 'O', 'œ', 'Œ', 0],
		KeyP: ['p', 'P', 'π', '∏', 0],
		KeyQ: ['a', 'A', 'æ', 'Æ', 0],
		KeyR: ['r', 'R', '®', '‚', 0],
		KeyS: ['s', 'S', 'Ò', '∑', 0],
		KeyT: ['t', 'T', '†', '™', 0],
		KeyU: ['u', 'U', 'º', 'ª', 0],
		KeyV: ['v', 'V', '◊', '√', 0],
		KeyW: ['z', 'Z', 'Â', 'Å', 0],
		KeyX: ['x', 'X', '≈', '⁄', 0],
		KeyY: ['y', 'Y', 'Ú', 'Ÿ', 0],
		KeyZ: ['w', 'W', '‹', '›', 0],
		Digit1: ['&', '1', '', '´', 8],
		Digit2: ['é', '2', 'ë', '„', 0],
		Digit3: ['"', '3', '“', '”', 0],
		Digit4: ['\'', '4', '‘', '’', 0],
		Digit5: ['(', '5', '{', '[', 0],
		Digit6: ['§', '6', '¶', 'å', 0],
		Digit7: ['è', '7', '«', '»', 0],
		Digit8: ['!', '8', '¡', 'Û', 0],
		Digit9: ['ç', '9', 'Ç', 'Á', 0],
		Digit0: ['à', '0', 'ø', 'Ø', 0],
		Enter: [],
		Escape: [],
		Backspace: [],
		Tab: [],
		Space: [' ', ' ', ' ', ' ', 0],
		Minus: [')', '°', '}', ']', 0],
		Equal: ['-', '_', '—', '–', 0],
		BracketLeft: ['^', '¨', 'ô', 'Ô', 3],
		BracketRight: ['$', '*', '€', '¥', 0],
		Backslash: ['`', '£', '@', '#', 1],
		Semicolon: ['m', 'M', 'µ', 'Ó', 0],
		Quote: ['ù', '%', 'Ù', '‰', 0],
		Backquote: ['<', '>', '≤', '≥', 0],
		Comma: [';', '.', '…', '•', 0],
		Period: [':', '/', '÷', '\\', 0],
		Slash: ['=', '+', '≠', '±', 0],
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
		NumpadDecimal: [',', '.', ',', '.', 0],
		IntlBackslash: ['@', '#', '•', 'Ÿ', 0],
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

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
	test('resolveKeybinding Cmd+Z', () => {
	});
});

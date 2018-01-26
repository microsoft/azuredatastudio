/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { KeyCode, KeyMod, KeyChord, createKeybinding, SimpleKeybinding } from 'vs/base/common/keyCodes';
import { KeybindingIO } from 'vs/workbench/services/keybinding/common/keybindingIO';
import { OS, OperatingSystem } from 'vs/base/common/platform';
import { IUserFriendlyKeybinding } from 'vs/platform/keybinding/common/keybinding';
import { USLayoutResolvedKeybinding } from 'vs/platform/keybinding/common/usLayoutResolvedKeybinding';
import { ScanCodeBinding, ScanCode } from 'vs/workbench/services/keybinding/common/scanCode';

suite('keybindingIO', () => {
	test('serialize/deserialize', function () {
	});
});

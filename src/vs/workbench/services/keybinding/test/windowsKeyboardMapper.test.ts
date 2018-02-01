/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { OperatingSystem } from 'vs/base/common/platform';
import { TPromise } from 'vs/base/common/winjs.base';
import { WindowsKeyboardMapper, IWindowsKeyboardMapping } from 'vs/workbench/services/keybinding/common/windowsKeyboardMapper';
import { createKeybinding, KeyMod, KeyCode, KeyChord, SimpleKeybinding } from 'vs/base/common/keyCodes';
import { IResolvedKeybinding, assertResolveKeybinding, readRawMapping, assertMapping, assertResolveKeyboardEvent, assertResolveUserBinding } from 'vs/workbench/services/keybinding/test/keyboardMapperTestUtils';
import { ScanCodeBinding, ScanCode } from 'vs/workbench/services/keybinding/common/scanCode';

const WRITE_FILE_IF_DIFFERENT = false;

suite('keyboardMapper - WINDOWS de_ch', () => {
	test('mapping', (done) => {
		done();
	});
});

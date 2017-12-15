/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { KeyMod, KeyCode, createKeybinding, SimpleKeybinding, KeyChord } from 'vs/base/common/keyCodes';
import { MacLinuxKeyboardMapper, IMacLinuxKeyboardMapping } from 'vs/workbench/services/keybinding/common/macLinuxKeyboardMapper';
import { OperatingSystem } from 'vs/base/common/platform';
import { UserSettingsLabelProvider } from 'vs/base/common/keybindingLabels';
import { USLayoutResolvedKeybinding } from 'vs/platform/keybinding/common/usLayoutResolvedKeybinding';
import { ScanCodeUtils, ScanCodeBinding, ScanCode } from 'vs/workbench/services/keybinding/common/scanCode';
import { TPromise } from 'vs/base/common/winjs.base';
import { readRawMapping, assertMapping, IResolvedKeybinding, assertResolveKeybinding, assertResolveKeyboardEvent, assertResolveUserBinding } from 'vs/workbench/services/keybinding/test/keyboardMapperTestUtils';

const WRITE_FILE_IF_DIFFERENT = false;

function createKeyboardMapper(isUSStandard: boolean, file: string, OS: OperatingSystem): TPromise<MacLinuxKeyboardMapper> {
	return readRawMapping<IMacLinuxKeyboardMapping>(file).then((rawMappings) => {
		return new MacLinuxKeyboardMapper(isUSStandard, rawMappings, OS);
	});
}

suite('keyboardMapper - MAC de_ch', () => {

	//let mapper: MacLinuxKeyboardMapper;

	suiteSetup((done) => {
		done();
		// createKeyboardMapper(false, 'mac_de_ch', OperatingSystem.Macintosh).then((_mapper) => {
		// 	mapper = _mapper;
		// 	done();
		// }, done);
	});

	test('mapping', (done) => {
		done();
	//	assertMapping(WRITE_FILE_IF_DIFFERENT, mapper, 'mac_de_ch.txt', done);
	});

	// function assertKeybindingTranslation(kb: number, expected: string | string[]): void {
	// 	_assertKeybindingTranslation(mapper, OperatingSystem.Macintosh, kb, expected);
	// }

	// function _assertResolveKeybinding(k: number, expected: IResolvedKeybinding[]): void {
	// 	assertResolveKeybinding(mapper, createKeybinding(k, OperatingSystem.Macintosh), expected);
	// }

});

function _assertKeybindingTranslation(mapper: MacLinuxKeyboardMapper, OS: OperatingSystem, kb: number, _expected: string | string[]): void {
	let expected: string[];
	if (typeof _expected === 'string') {
		expected = [_expected];
	} else if (Array.isArray(_expected)) {
		expected = _expected;
	} else {
		expected = [];
	}

	const runtimeKeybinding = createKeybinding(kb, OS);

	const keybindingLabel = new USLayoutResolvedKeybinding(runtimeKeybinding, OS).getUserSettingsLabel();

	const actualHardwareKeypresses = mapper.simpleKeybindingToScanCodeBinding(<SimpleKeybinding>runtimeKeybinding);
	if (actualHardwareKeypresses.length === 0) {
		assert.deepEqual([], expected, `simpleKeybindingToHardwareKeypress -- "${keybindingLabel}" -- actual: "[]" -- expected: "${expected}"`);
		return;
	}

	const actual = actualHardwareKeypresses
		.map(k => UserSettingsLabelProvider.toLabel(k, ScanCodeUtils.toString(k.scanCode), null, null, OS));
	assert.deepEqual(actual, expected, `simpleKeybindingToHardwareKeypress -- "${keybindingLabel}" -- actual: "${actual}" -- expected: "${expected}"`);
}

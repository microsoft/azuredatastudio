/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { LanguagesRegistry } from 'vs/editor/common/services/languagesRegistry';
// import { ModeServiceImpl } from 'vs/editor/common/services/modeServiceImpl';

/**
 * This function is called before test running and also again at the end of test running
 * and can be used to add assertions. e.g. that registries are empty, etc.
 */
export function assertCleanState(): void {
	// If this test fails, it is a clear indication that
	// your test or suite is leaking services (e.g. via leaking text models)
	// assert.strictEqual(ModeServiceImpl.instanceCount, 0, 'No leaking IModeService');
	assert.strictEqual(LanguagesRegistry.instanceCount, 0, 'No leaking LanguagesRegistry');
}

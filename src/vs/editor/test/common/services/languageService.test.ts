/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { throwIfDisposablesAreLeaked } from 'vs/base/test/common/utils';
import { PLAINTEXT_LANGUAGE_ID } from 'vs/editor/common/languages/modesRegistry';
import { LanguageService } from 'vs/editor/common/services/languageService';

suite('LanguageService', () => {

	test('LanguageSelection does not leak a disposable', () => {
		const languageService = new LanguageService();
		throwIfDisposablesAreLeaked(() => {
			const languageSelection = languageService.createById(PLAINTEXT_LANGUAGE_ID);
			assert.strictEqual(languageSelection.languageId, PLAINTEXT_LANGUAGE_ID);
		});
		throwIfDisposablesAreLeaked(() => {
			const languageSelection = languageService.createById(PLAINTEXT_LANGUAGE_ID);
			const listener = languageSelection.onDidChange(() => { });
			assert.strictEqual(languageSelection.languageId, PLAINTEXT_LANGUAGE_ID);
			listener.dispose();
		});
		languageService.dispose();

	});

});

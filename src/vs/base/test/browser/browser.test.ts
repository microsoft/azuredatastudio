/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { isMacintosh, isWindows } from 'vs/base/common/platform';

suite('Browsers', () => {
	test('all', () => {
		assert(!(isWindows && isMacintosh));
	});
});

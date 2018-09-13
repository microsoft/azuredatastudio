/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { EditorOptions, TextEditorOptions } from 'vs/workbench/common/editor';

suite('Workbench editor options', () => {

	test('EditorOptions', function () {
		let options = new EditorOptions();

		assert(!options.preserveFocus);
		options.preserveFocus = true;
		assert(options.preserveFocus);
		assert(!options.forceReload);
		options.forceReload = true;
		assert(options.forceReload);

		options = new EditorOptions();
		options.forceReload = true;
	});

	test('TextEditorOptions', function () {
		let options = new TextEditorOptions();
		let otherOptions = new TextEditorOptions();

		assert(!options.hasOptionsDefined());
		options.selection(1, 1, 2, 2);
		assert(options.hasOptionsDefined());

		otherOptions.selection(1, 1, 2, 2);

		options = new TextEditorOptions();
		options.forceReload = true;
		options.selection(1, 1, 2, 2);
	});
});
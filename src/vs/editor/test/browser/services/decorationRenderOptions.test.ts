/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as dom from 'vs/base/browser/dom';
import { URI } from 'vs/base/common/uri';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { CodeEditorServiceImpl } from 'vs/editor/browser/services/codeEditorServiceImpl';
import { IDecorationRenderOptions } from 'vs/editor/common/editorCommon';
import { IResourceInput } from 'vs/platform/editor/common/editor';
import { TestTheme, TestThemeService } from 'vs/platform/theme/test/common/testThemeService';

const themeServiceMock = new TestThemeService();

// {{SQL CARBON EDIT}} - Remove exported test class
suite('Decoration Render Options', () => {
	test('register and resolve decoration type', () => {
		// {{SQL CARBON EDIT}} - Remove test
	});
});

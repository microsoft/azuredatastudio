/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import URI from 'vs/base/common/uri';
import * as dom from 'vs/base/browser/dom';
import { CodeEditorServiceImpl } from 'vs/editor/browser/services/codeEditorServiceImpl';
import { IDecorationRenderOptions } from 'vs/editor/common/editorCommon';
import { TestTheme, TestThemeService } from 'vs/platform/theme/test/common/testThemeService';

const themeServiceMock = new TestThemeService();

suite('Decoration Render Options', () => {
	test('register and resolve decoration type', () => {
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { replaceWhitespace, renderExpressionValue, renderVariable } from 'vs/workbench/parts/debug/browser/baseDebugView';
import * as dom from 'vs/base/browser/dom';
import { Expression, Variable, Scope, StackFrame, Thread } from 'vs/workbench/parts/debug/common/debugModel';
import { MockSession } from 'vs/workbench/parts/debug/test/common/mockDebug';
const $ = dom.$;

suite('Debug - Base Debug View', () => {

	test('replace whitespace', () => {
		assert.equal(replaceWhitespace('hey there'), 'hey there');
		assert.equal(replaceWhitespace('hey there\n'), 'hey there\\n');
		assert.equal(replaceWhitespace('hey \r there\n\t'), 'hey \\r there\\n\\t');
		assert.equal(replaceWhitespace('hey \r\t\n\t\t\n there'), 'hey \\r\\t\\n\\t\\t\\n there');
	});

	test('render variable', () => {
		// {{SQL CARBON EDIT}} - Disable test
	});
});

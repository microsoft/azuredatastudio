/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { TerminalConfigHelper } from 'vs/workbench/parts/terminal/electron-browser/terminalConfigHelper';
import { EDITOR_FONT_DEFAULTS } from 'vs/editor/common/config/editorOptions';
import { isFedora, isUbuntu } from 'vs/workbench/parts/terminal/node/terminal';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';

suite('Workbench - TerminalConfigHelper', () => {
	test('TerminalConfigHelper - getFont fontFamily', function () {
		// {{SQL CARBON EDIT}} - Remove tests
	});
});
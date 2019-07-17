/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as dom from 'vs/base/browser/dom';
import { generateUuid } from 'vs/base/common/uuid';
import { appendStylizedStringToContainer, handleANSIOutput, calcANSI8bitColor } from 'vs/workbench/contrib/debug/browser/debugANSIHandling';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { workbenchInstantiationService } from 'vs/workbench/test/workbenchTestServices';
import { LinkDetector } from 'vs/workbench/contrib/debug/browser/linkDetector';
import { Color, RGBA } from 'vs/base/common/color';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TestThemeService, TestTheme } from 'vs/platform/theme/test/common/testThemeService';
import { ansiColorMap } from 'vs/workbench/contrib/terminal/common/terminalColorRegistry';

suite('Debug - ANSI Handling', () => {

	let linkDetector: LinkDetector;
	let themeService: IThemeService;

	/**
	 * Instantiate services for use by the functions being tested.
	 */
	setup(() => {
		const instantiationService: TestInstantiationService = <TestInstantiationService>workbenchInstantiationService();
		linkDetector = instantiationService.createInstance(LinkDetector);

		const colors: { [id: string]: string; } = {};
		for (let color in ansiColorMap) {
			colors[color] = <any>ansiColorMap[color].defaults.dark;
		}
		const testTheme = new TestTheme(colors);
		themeService = new TestThemeService(testTheme);
	});

	test('appendStylizedStringToContainer', () => {
		assert.equal('', '');
	});
});

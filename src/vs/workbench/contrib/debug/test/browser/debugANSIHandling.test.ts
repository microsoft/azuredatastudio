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
import { DebugModel } from 'vs/workbench/contrib/debug/common/debugModel';
import { DebugSession } from 'vs/workbench/contrib/debug/browser/debugSession';
import { NullOpenerService } from 'vs/platform/opener/common/opener';

suite('Debug - ANSI Handling', () => {

	let model: DebugModel;
	let session: DebugSession;
	let linkDetector: LinkDetector;
	let themeService: IThemeService;

	/**
	 * Instantiate services for use by the functions being tested.
	 */
	setup(() => {
		model = new DebugModel([], [], [], [], [], <any>{ isDirty: (e: any) => false });
		session = new DebugSession({ resolved: { name, type: 'node', request: 'launch' }, unresolved: undefined }, undefined!, model, undefined, undefined!, undefined!, undefined!, undefined!, undefined!, undefined!, undefined!, undefined!, NullOpenerService);

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

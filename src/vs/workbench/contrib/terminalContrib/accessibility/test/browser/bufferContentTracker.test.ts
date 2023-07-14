/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { isWindows } from 'vs/base/common/platform';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { ContextMenuService } from 'vs/platform/contextview/browser/contextMenuService';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { TerminalCapability } from 'vs/platform/terminal/common/capabilities/capabilities';
import { TerminalCapabilityStore } from 'vs/platform/terminal/common/capabilities/terminalCapabilityStore';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { TerminalConfigHelper } from 'vs/workbench/contrib/terminal/browser/terminalConfigHelper';
import { writeP } from 'vs/workbench/contrib/terminal/browser/terminalTestHelpers';
import { XtermTerminal } from 'vs/workbench/contrib/terminal/browser/xterm/xtermTerminal';
import { ITerminalConfiguration } from 'vs/workbench/contrib/terminal/common/terminal';
import { BufferContentTracker, replaceWithNonBreakingSpaces } from 'vs/workbench/contrib/terminalContrib/accessibility/browser/bufferContentTracker';
import { ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { TestLifecycleService } from 'vs/workbench/test/browser/workbenchTestServices';
import { Terminal } from 'xterm';

const defaultTerminalConfig: Partial<ITerminalConfiguration> = {
	fontFamily: 'monospace',
	fontWeight: 'normal',
	fontWeightBold: 'normal',
	gpuAcceleration: 'off',
	scrollback: 1000,
	fastScrollSensitivity: 2,
	mouseWheelScrollSensitivity: 1,
	unicodeVersion: '6'
};

suite('Buffer Content Tracker', () => {
	let instantiationService: TestInstantiationService;
	let configurationService: TestConfigurationService;
	let themeService: TestThemeService;
	let xterm: XtermTerminal;
	let capabilities: TerminalCapabilityStore;
	let configHelper: TerminalConfigHelper;
	let bufferTracker: BufferContentTracker;
	const prompt = 'vscode-git:(prompt/more-tests)';
	const promptPlusData = 'vscode-git:(prompt/more-tests) ' + 'some data';
	setup(() => {
		configurationService = new TestConfigurationService({ terminal: { integrated: defaultTerminalConfig } });
		instantiationService = new TestInstantiationService();
		themeService = new TestThemeService();
		instantiationService = new TestInstantiationService();
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(IThemeService, themeService);
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IContextMenuService, instantiationService.createInstance(ContextMenuService));
		instantiationService.stub(ILifecycleService, new TestLifecycleService());
		configHelper = instantiationService.createInstance(TerminalConfigHelper);
		capabilities = new TerminalCapabilityStore();
		if (!isWindows) {
			capabilities.add(TerminalCapability.NaiveCwdDetection, null!);
		}
		xterm = instantiationService.createInstance(XtermTerminal, Terminal, configHelper, 80, 30, { getBackgroundColor: () => undefined }, capabilities, '', new MockContextKeyService().createKey('', true)!, true);
		const container = document.createElement('div');
		xterm.raw.open(container);
		configurationService = new TestConfigurationService({ terminal: { integrated: { tabs: { separator: ' - ', title: '${cwd}', description: '${cwd}' } } } });
		configHelper = new TerminalConfigHelper(configurationService, null!, null!, null!, null!);
		bufferTracker = instantiationService.createInstance(BufferContentTracker, xterm);
	});
	test('should not clear the prompt line', async () => {
		assert.strictEqual(bufferTracker.lines.length, 0);
		await writeP(xterm.raw, prompt);
		xterm.clearBuffer();
		await bufferTracker.update();
		assert.deepStrictEqual(bufferTracker.lines, [prompt]);
		assert.strictEqual(bufferTracker.lines.length, 1);
	});
	test('repeated updates should not change the content', async () => {
		assert.strictEqual(bufferTracker.lines.length, 0);
		await writeP(xterm.raw, prompt);
		await bufferTracker.update();
		assert.deepStrictEqual(bufferTracker.lines, [prompt]);
		assert.strictEqual(bufferTracker.lines.length, 1);
		await bufferTracker.update();
		assert.deepStrictEqual(bufferTracker.lines, [prompt]);
		assert.strictEqual(bufferTracker.lines.length, 1);
		await bufferTracker.update();
		assert.deepStrictEqual(bufferTracker.lines, [prompt]);
		assert.strictEqual(bufferTracker.lines.length, 1);
	});
	test('should add lines in the viewport and scrollback', async () => {
		await writeAndAssertBufferState(promptPlusData, 38, xterm.raw, bufferTracker);
	});
	// {{SQL CARBON TODO}} - see why this is failing intermittently
	test.skip('should add lines in the viewport and full scrollback', async () => {
		await writeAndAssertBufferState(promptPlusData, 1030, xterm.raw, bufferTracker);
	});
	test('should refresh viewport', async () => {
		await writeAndAssertBufferState(promptPlusData, 6, xterm.raw, bufferTracker);
		await writeP(xterm.raw, '\x1b[3Ainserteddata');
		await bufferTracker.update();
		assert.deepStrictEqual(bufferTracker.lines, [promptPlusData, promptPlusData, `${promptPlusData}inserteddata`, promptPlusData, promptPlusData, promptPlusData].map(s => replaceWithNonBreakingSpaces(s)));
	});
	test('should refresh viewport with full scrollback', async () => {
		const content = replaceWithNonBreakingSpaces(`${prompt}\r\n`.repeat(1030).trimEnd());
		await writeP(xterm.raw, content);
		await bufferTracker.update();
		await writeP(xterm.raw, '\x1b[4Ainsertion');
		await bufferTracker.update();
		const expected = content.split('\r\n');
		expected[1025] = `${prompt}insertion`;
		assert.deepStrictEqual(bufferTracker.lines[1025], `${prompt}insertion`);
	});
	test('should cap the size of the cached lines, removing old lines in favor of new lines', async () => {
		const content = `${prompt}\r\n`.repeat(1036).trimEnd();
		await writeP(xterm.raw, content);
		await bufferTracker.update();
		const expected = content.split('\r\n').map(s => replaceWithNonBreakingSpaces(s));
		// delete the 6 lines that should be trimmed
		for (let i = 0; i < 6; i++) {
			expected.pop();
		}
		// insert a new character
		await writeP(xterm.raw, '\x1b[2Ainsertion');
		await bufferTracker.update();
		expected[1027] = `${prompt}insertion`;
		assert.strictEqual(bufferTracker.lines.length, expected.length);
		assert.deepStrictEqual(bufferTracker.lines, expected);
	});
});

async function writeAndAssertBufferState(data: string, rows: number, terminal: Terminal, bufferTracker: BufferContentTracker): Promise<void> {
	const content = `${data}\r\n`.repeat(rows).trimEnd();
	await writeP(terminal, content);
	await bufferTracker.update();
	assert.strictEqual(bufferTracker.lines.length, rows);
	assert.deepStrictEqual(bufferTracker.lines, content.split('\r\n').map(s => replaceWithNonBreakingSpaces(s)));
}


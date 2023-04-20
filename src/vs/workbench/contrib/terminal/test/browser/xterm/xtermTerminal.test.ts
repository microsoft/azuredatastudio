/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEvent, Terminal } from 'xterm';
import { XtermTerminal } from 'vs/workbench/contrib/terminal/browser/xterm/xtermTerminal';
import { TerminalConfigHelper } from 'vs/workbench/contrib/terminal/browser/terminalConfigHelper';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ITerminalConfigHelper, ITerminalConfiguration, TERMINAL_VIEW_ID } from 'vs/workbench/contrib/terminal/common/terminal';
import { deepStrictEqual, strictEqual } from 'assert';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { TestColorTheme, TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IViewDescriptor, IViewDescriptorService, ViewContainerLocation } from 'vs/workbench/common/views';
import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import { Emitter } from 'vs/base/common/event';
import { TERMINAL_BACKGROUND_COLOR, TERMINAL_FOREGROUND_COLOR, TERMINAL_CURSOR_FOREGROUND_COLOR, TERMINAL_CURSOR_BACKGROUND_COLOR, TERMINAL_SELECTION_BACKGROUND_COLOR, TERMINAL_SELECTION_FOREGROUND_COLOR } from 'vs/workbench/contrib/terminal/common/terminalColorRegistry';
import { PANEL_BACKGROUND, SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { WebglAddon } from 'xterm-addon-webgl';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { isSafari } from 'vs/base/browser/browser';
import { TerminalLocation } from 'vs/platform/terminal/common/terminal';
import { TerminalCapabilityStore } from 'vs/platform/terminal/common/capabilities/terminalCapabilityStore';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ContextMenuService } from 'vs/platform/contextview/browser/contextMenuService';

class TestWebglAddon {
	static shouldThrow = false;
	static isEnabled = false;
	readonly onContextLoss = new Emitter().event as IEvent<void>;
	activate() {
		TestWebglAddon.isEnabled = !TestWebglAddon.shouldThrow;
		if (TestWebglAddon.shouldThrow) {
			throw new Error('Test webgl set to throw');
		}
	}
	dispose() {
		TestWebglAddon.isEnabled = false;
	}
	clearTextureAtlas() { }
}

class TestXtermTerminal extends XtermTerminal {
	webglAddonPromise: Promise<typeof WebglAddon> = Promise.resolve(TestWebglAddon);
	protected override _getWebglAddonConstructor() {
		// Force synchronous to avoid async when activating the addon
		return this.webglAddonPromise;
	}
}

export class TestViewDescriptorService implements Partial<IViewDescriptorService> {
	private _location = ViewContainerLocation.Panel;
	private _onDidChangeLocation = new Emitter<{ views: IViewDescriptor[]; from: ViewContainerLocation; to: ViewContainerLocation }>();
	onDidChangeLocation = this._onDidChangeLocation.event;
	getViewLocationById(id: string) {
		return this._location;
	}
	moveTerminalToLocation(to: ViewContainerLocation) {
		const oldLocation = this._location;
		this._location = to;
		this._onDidChangeLocation.fire({
			views: [
				{ id: TERMINAL_VIEW_ID } as any
			],
			from: oldLocation,
			to
		});
	}
}

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

suite('XtermTerminal', () => {
	let instantiationService: TestInstantiationService;
	let configurationService: TestConfigurationService;
	let themeService: TestThemeService;
	let viewDescriptorService: TestViewDescriptorService;
	let xterm: TestXtermTerminal;
	let configHelper: ITerminalConfigHelper;

	setup(() => {
		configurationService = new TestConfigurationService({
			editor: {
				fastScrollSensitivity: 2,
				mouseWheelScrollSensitivity: 1
			} as Partial<IEditorOptions>,
			terminal: {
				integrated: defaultTerminalConfig
			}
		});
		themeService = new TestThemeService();
		viewDescriptorService = new TestViewDescriptorService();

		instantiationService = new TestInstantiationService();
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IStorageService, new TestStorageService());
		instantiationService.stub(IThemeService, themeService);
		instantiationService.stub(IViewDescriptorService, viewDescriptorService);
		instantiationService.stub(IContextMenuService, instantiationService.createInstance(ContextMenuService));

		configHelper = instantiationService.createInstance(TerminalConfigHelper);
		xterm = instantiationService.createInstance(TestXtermTerminal, Terminal, configHelper, 80, 30, TerminalLocation.Panel, new TerminalCapabilityStore(), true);

		TestWebglAddon.shouldThrow = false;
		TestWebglAddon.isEnabled = false;
	});

	test('should use fallback dimensions of 80x30', () => {
		strictEqual(xterm.raw.options.cols, 80);
		strictEqual(xterm.raw.options.rows, 30);
	});

	suite('theme', () => {
		test('should apply correct background color based on the current view', () => {
			themeService.setTheme(new TestColorTheme({
				[PANEL_BACKGROUND]: '#ff0000',
				[SIDE_BAR_BACKGROUND]: '#00ff00'
			}));
			xterm = instantiationService.createInstance(XtermTerminal, Terminal, configHelper, 80, 30, TerminalLocation.Panel, new TerminalCapabilityStore(), true);
			strictEqual(xterm.raw.options.theme?.background, '#ff0000');
			viewDescriptorService.moveTerminalToLocation(ViewContainerLocation.Sidebar);
			strictEqual(xterm.raw.options.theme?.background, '#00ff00');
			viewDescriptorService.moveTerminalToLocation(ViewContainerLocation.Panel);
			strictEqual(xterm.raw.options.theme?.background, '#ff0000');
			viewDescriptorService.moveTerminalToLocation(ViewContainerLocation.AuxiliaryBar);
			strictEqual(xterm.raw.options.theme?.background, '#00ff00');
		});
		test('should react to and apply theme changes', () => {
			themeService.setTheme(new TestColorTheme({
				[TERMINAL_BACKGROUND_COLOR]: '#000100',
				[TERMINAL_FOREGROUND_COLOR]: '#000200',
				[TERMINAL_CURSOR_FOREGROUND_COLOR]: '#000300',
				[TERMINAL_CURSOR_BACKGROUND_COLOR]: '#000400',
				[TERMINAL_SELECTION_BACKGROUND_COLOR]: '#000500',
				[TERMINAL_SELECTION_FOREGROUND_COLOR]: undefined,
				'terminal.ansiBlack': '#010000',
				'terminal.ansiRed': '#020000',
				'terminal.ansiGreen': '#030000',
				'terminal.ansiYellow': '#040000',
				'terminal.ansiBlue': '#050000',
				'terminal.ansiMagenta': '#060000',
				'terminal.ansiCyan': '#070000',
				'terminal.ansiWhite': '#080000',
				'terminal.ansiBrightBlack': '#090000',
				'terminal.ansiBrightRed': '#100000',
				'terminal.ansiBrightGreen': '#110000',
				'terminal.ansiBrightYellow': '#120000',
				'terminal.ansiBrightBlue': '#130000',
				'terminal.ansiBrightMagenta': '#140000',
				'terminal.ansiBrightCyan': '#150000',
				'terminal.ansiBrightWhite': '#160000',
			}));
			xterm = instantiationService.createInstance(XtermTerminal, Terminal, configHelper, 80, 30, TerminalLocation.Panel, new TerminalCapabilityStore(), true);
			deepStrictEqual(xterm.raw.options.theme, {
				background: '#000100',
				foreground: '#000200',
				cursor: '#000300',
				cursorAccent: '#000400',
				selection: '#000500',
				selectionForeground: undefined,
				black: '#010000',
				green: '#030000',
				red: '#020000',
				yellow: '#040000',
				blue: '#050000',
				magenta: '#060000',
				cyan: '#070000',
				white: '#080000',
				brightBlack: '#090000',
				brightRed: '#100000',
				brightGreen: '#110000',
				brightYellow: '#120000',
				brightBlue: '#130000',
				brightMagenta: '#140000',
				brightCyan: '#150000',
				brightWhite: '#160000',
			});
			themeService.setTheme(new TestColorTheme({
				[TERMINAL_BACKGROUND_COLOR]: '#00010f',
				[TERMINAL_FOREGROUND_COLOR]: '#00020f',
				[TERMINAL_CURSOR_FOREGROUND_COLOR]: '#00030f',
				[TERMINAL_CURSOR_BACKGROUND_COLOR]: '#00040f',
				[TERMINAL_SELECTION_BACKGROUND_COLOR]: '#00050f',
				[TERMINAL_SELECTION_FOREGROUND_COLOR]: '#00060f',
				'terminal.ansiBlack': '#01000f',
				'terminal.ansiRed': '#02000f',
				'terminal.ansiGreen': '#03000f',
				'terminal.ansiYellow': '#04000f',
				'terminal.ansiBlue': '#05000f',
				'terminal.ansiMagenta': '#06000f',
				'terminal.ansiCyan': '#07000f',
				'terminal.ansiWhite': '#08000f',
				'terminal.ansiBrightBlack': '#09000f',
				'terminal.ansiBrightRed': '#10000f',
				'terminal.ansiBrightGreen': '#11000f',
				'terminal.ansiBrightYellow': '#12000f',
				'terminal.ansiBrightBlue': '#13000f',
				'terminal.ansiBrightMagenta': '#14000f',
				'terminal.ansiBrightCyan': '#15000f',
				'terminal.ansiBrightWhite': '#16000f',
			}));
			deepStrictEqual(xterm.raw.options.theme, {
				background: '#00010f',
				foreground: '#00020f',
				cursor: '#00030f',
				cursorAccent: '#00040f',
				selection: '#00050f',
				selectionForeground: '#00060f',
				black: '#01000f',
				green: '#03000f',
				red: '#02000f',
				yellow: '#04000f',
				blue: '#05000f',
				magenta: '#06000f',
				cyan: '#07000f',
				white: '#08000f',
				brightBlack: '#09000f',
				brightRed: '#10000f',
				brightGreen: '#11000f',
				brightYellow: '#12000f',
				brightBlue: '#13000f',
				brightMagenta: '#14000f',
				brightCyan: '#15000f',
				brightWhite: '#16000f',
			});
		});
	});

	suite('renderers', () => {
		test('should re-evaluate gpu acceleration auto when the setting is changed', async () => {
			// Check initial state
			strictEqual(xterm.raw.options.rendererType, 'dom');
			strictEqual(TestWebglAddon.isEnabled, false);

			// Open xterm as otherwise the webgl addon won't activate
			const container = document.createElement('div');
			xterm.raw.open(container);

			// Auto should activate the webgl addon
			await configurationService.setUserConfiguration('terminal', { integrated: { ...defaultTerminalConfig, gpuAcceleration: 'auto' } });
			configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true } as any);
			await xterm.webglAddonPromise; // await addon activate
			if (isSafari) {
				strictEqual(TestWebglAddon.isEnabled, false, 'The webgl renderer is always disabled on Safari');
			} else {
				strictEqual(TestWebglAddon.isEnabled, true);
			}

			// Turn off to reset state
			await configurationService.setUserConfiguration('terminal', { integrated: { ...defaultTerminalConfig, gpuAcceleration: 'off' } });
			configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true } as any);
			await xterm.webglAddonPromise; // await addon activate
			strictEqual(xterm.raw.options.rendererType, 'dom');
			strictEqual(TestWebglAddon.isEnabled, false);

			// Set to auto again but throw when activating the webgl addon
			TestWebglAddon.shouldThrow = true;
			await configurationService.setUserConfiguration('terminal', { integrated: { ...defaultTerminalConfig, gpuAcceleration: 'auto' } });
			configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true } as any);
			await xterm.webglAddonPromise; // await addon activate
			strictEqual(xterm.raw.options.rendererType, 'canvas');
			strictEqual(TestWebglAddon.isEnabled, false);
		});
	});
});

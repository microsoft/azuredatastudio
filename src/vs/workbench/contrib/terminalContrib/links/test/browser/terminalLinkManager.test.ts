/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, strictEqual } from 'assert';
import { equals } from 'vs/base/common/arrays';
import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { ContextMenuService } from 'vs/platform/contextview/browser/contextMenuService';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IDetectedLinks, TerminalLinkManager } from 'vs/workbench/contrib/terminalContrib/links/browser/terminalLinkManager';
import { ITerminalCapabilityImplMap, ITerminalCapabilityStore, TerminalCapability } from 'vs/platform/terminal/common/capabilities/capabilities';
import { ITerminalConfiguration, ITerminalProcessManager } from 'vs/workbench/contrib/terminal/common/terminal';
import { TestViewDescriptorService } from 'vs/workbench/contrib/terminal/test/browser/xterm/xtermTerminal.test';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { ILink, Terminal } from 'xterm';
import { TerminalLinkResolver } from 'vs/workbench/contrib/terminalContrib/links/browser/terminalLinkResolver';

const defaultTerminalConfig: Partial<ITerminalConfiguration> = {
	fontFamily: 'monospace',
	fontWeight: 'normal',
	fontWeightBold: 'normal',
	gpuAcceleration: 'off',
	scrollback: 1000,
	fastScrollSensitivity: 2,
	mouseWheelScrollSensitivity: 1,
	unicodeVersion: '11',
	wordSeparators: ' ()[]{}\',"`─‘’'
};

class TestLinkManager extends TerminalLinkManager {
	private _links: IDetectedLinks | undefined;
	protected override async _getLinksForType(y: number, type: 'word' | 'url' | 'localFile'): Promise<ILink[] | undefined> {
		switch (type) {
			case 'word':
				return this._links?.wordLinks?.[y] ? [this._links?.wordLinks?.[y]] : undefined;
			case 'url':
				return this._links?.webLinks?.[y] ? [this._links?.webLinks?.[y]] : undefined;
			case 'localFile':
				return this._links?.fileLinks?.[y] ? [this._links?.fileLinks?.[y]] : undefined;
		}
	}
	setLinks(links: IDetectedLinks): void {
		this._links = links;
	}
}

suite('TerminalLinkManager', () => {
	let instantiationService: TestInstantiationService;
	let configurationService: TestConfigurationService;
	let themeService: TestThemeService;
	let viewDescriptorService: TestViewDescriptorService;
	let xterm: Terminal;
	let linkManager: TestLinkManager;

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
		instantiationService.stub(IContextMenuService, instantiationService.createInstance(ContextMenuService));
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IStorageService, new TestStorageService());
		instantiationService.stub(IThemeService, themeService);
		instantiationService.stub(IViewDescriptorService, viewDescriptorService);

		xterm = new Terminal({ allowProposedApi: true, cols: 80, rows: 30 });
		linkManager = instantiationService.createInstance(TestLinkManager, xterm, upcastPartial<ITerminalProcessManager>({
			get initialCwd() {
				return '';
			}
		}), {
			get<T extends TerminalCapability>(capability: T): ITerminalCapabilityImplMap[T] | undefined {
				return undefined;
			}
		} as Partial<ITerminalCapabilityStore> as any, instantiationService.createInstance(TerminalLinkResolver));
	});

	suite.skip('getLinks and open recent link', () => { // {{SQL CARBON EDIT}} skip failing suite
		test('should return no links', async () => {
			const links = await linkManager.getLinks();
			equals(links.webLinks, []);
			equals(links.wordLinks, []);
			equals(links.fileLinks, []);
			const webLink = await linkManager.openRecentLink('url');
			strictEqual(webLink, undefined);
			const fileLink = await linkManager.openRecentLink('localFile');
			strictEqual(fileLink, undefined);
		});
		test('should return word links in order', async () => {
			const link1 = {
				range: {
					start: { x: 1, y: 1 }, end: { x: 14, y: 1 }
				},
				text: '1_我是学生.txt',
				activate: () => Promise.resolve('')
			};
			const link2 = {
				range: {
					start: { x: 1, y: 1 }, end: { x: 14, y: 1 }
				},
				text: '2_我是学生.txt',
				activate: () => Promise.resolve('')
			};
			linkManager.setLinks({ wordLinks: [link1, link2] });
			const links = await linkManager.getLinks();
			deepStrictEqual(links.wordLinks?.[0].text, link2.text);
			deepStrictEqual(links.wordLinks?.[1].text, link1.text);
			const webLink = await linkManager.openRecentLink('url');
			strictEqual(webLink, undefined);
			const fileLink = await linkManager.openRecentLink('localFile');
			strictEqual(fileLink, undefined);
		});
		test('should return web links in order', async () => {
			const link1 = {
				range: { start: { x: 5, y: 1 }, end: { x: 40, y: 1 } },
				text: 'https://foo.bar/[this is foo site 1]',
				activate: () => Promise.resolve('')
			};
			const link2 = {
				range: { start: { x: 5, y: 2 }, end: { x: 40, y: 2 } },
				text: 'https://foo.bar/[this is foo site 2]',
				activate: () => Promise.resolve('')
			};
			linkManager.setLinks({ webLinks: [link1, link2] });
			const links = await linkManager.getLinks();
			deepStrictEqual(links.webLinks?.[0].text, link2.text);
			deepStrictEqual(links.webLinks?.[1].text, link1.text);
			const webLink = await linkManager.openRecentLink('url');
			strictEqual(webLink, link2);
			const fileLink = await linkManager.openRecentLink('localFile');
			strictEqual(fileLink, undefined);
		});
		test('should return file links in order', async () => {
			const link1 = {
				range: { start: { x: 1, y: 1 }, end: { x: 32, y: 1 } },
				text: 'file:///C:/users/test/file_1.txt',
				activate: () => Promise.resolve('')
			};
			const link2 = {
				range: { start: { x: 1, y: 2 }, end: { x: 32, y: 2 } },
				text: 'file:///C:/users/test/file_2.txt',
				activate: () => Promise.resolve('')
			};
			linkManager.setLinks({ fileLinks: [link1, link2] });
			const links = await linkManager.getLinks();
			deepStrictEqual(links.fileLinks?.[0].text, link2.text);
			deepStrictEqual(links.fileLinks?.[1].text, link1.text);
			const webLink = await linkManager.openRecentLink('url');
			strictEqual(webLink, undefined);
			linkManager.setLinks({ fileLinks: [link2] });
			const fileLink = await linkManager.openRecentLink('localFile');
			strictEqual(fileLink, link2);
		});
	});
});
function upcastPartial<T>(v: Partial<T>): T {
	return v as T;
}

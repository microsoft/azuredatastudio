/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { TerminalConfigHelper } from 'vs/workbench/contrib/terminal/browser/terminalConfigHelper';
import { EDITOR_FONT_DEFAULTS } from 'vs/editor/common/config/editorOptions';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { LinuxDistro } from 'vs/workbench/contrib/terminal/browser/terminal';

class TestTerminalConfigHelper extends TerminalConfigHelper {
	set linuxDistro(distro: LinuxDistro) {
		this._linuxDistro = distro;
	}
}

suite.skip('Workbench - TerminalConfigHelper', () => { // {{SQL CARBON EDIT}} skip suite
	let fixture: HTMLElement;

	setup(() => {
		fixture = document.body;
	});

	test('TerminalConfigHelper - getFont fontFamily', () => {
		const configurationService = new TestConfigurationService({
			editor: { fontFamily: 'foo' },
			terminal: { integrated: { fontFamily: 'bar' } }
		});
		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().fontFamily, 'bar', 'terminal.integrated.fontFamily should be selected over editor.fontFamily');
	});

	test('TerminalConfigHelper - getFont fontFamily (Linux Fedora)', () => {
		const configurationService = new TestConfigurationService({
			editor: { fontFamily: 'foo' },
			terminal: { integrated: { fontFamily: null } }
		});
		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.linuxDistro = LinuxDistro.Fedora;
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().fontFamily, '\'DejaVu Sans Mono\', monospace', 'Fedora should have its font overridden when terminal.integrated.fontFamily not set');
	});

	test('TerminalConfigHelper - getFont fontFamily (Linux Ubuntu)', () => {
		const configurationService = new TestConfigurationService({
			editor: { fontFamily: 'foo' },
			terminal: { integrated: { fontFamily: null } }
		});
		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.linuxDistro = LinuxDistro.Ubuntu;
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().fontFamily, '\'Ubuntu Mono\', monospace', 'Ubuntu should have its font overridden when terminal.integrated.fontFamily not set');
	});

	test('TerminalConfigHelper - getFont fontFamily (Linux Unknown)', () => {
		const configurationService = new TestConfigurationService({
			editor: { fontFamily: 'foo' },
			terminal: { integrated: { fontFamily: null } }
		});
		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().fontFamily, 'foo', 'editor.fontFamily should be the fallback when terminal.integrated.fontFamily not set');
	});

	test('TerminalConfigHelper - getFont fontSize 10', () => {
		const configurationService = new TestConfigurationService({
			editor: {
				fontFamily: 'foo',
				fontSize: 9
			},
			terminal: {
				integrated: {
					fontFamily: 'bar',
					fontSize: 10
				}
			}
		});
		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().fontSize, 10, 'terminal.integrated.fontSize should be selected over editor.fontSize');
	});

	test('TerminalConfigHelper - getFont fontSize 0', () => {
		const configurationService = new TestConfigurationService({
			editor: {
				fontFamily: 'foo'
			},
			terminal: {
				integrated: {
					fontFamily: null,
					fontSize: 0
				}
			}
		});
		let configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.linuxDistro = LinuxDistro.Ubuntu;
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().fontSize, 8, 'The minimum terminal font size (with adjustment) should be used when terminal.integrated.fontSize less than it');

		configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().fontSize, 6, 'The minimum terminal font size should be used when terminal.integrated.fontSize less than it');
	});

	test('TerminalConfigHelper - getFont fontSize 1500', () => {
		const configurationService = new TestConfigurationService({
			editor: {
				fontFamily: 'foo'
			},
			terminal: {
				integrated: {
					fontFamily: 0,
					fontSize: 1500
				}
			}
		});
		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().fontSize, 100, 'The maximum terminal font size should be used when terminal.integrated.fontSize more than it');
	});

	test('TerminalConfigHelper - getFont fontSize null', () => {
		const configurationService = new TestConfigurationService({
			editor: {
				fontFamily: 'foo'
			},
			terminal: {
				integrated: {
					fontFamily: 0,
					fontSize: null
				}
			}
		});
		let configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.linuxDistro = LinuxDistro.Ubuntu;
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().fontSize, EDITOR_FONT_DEFAULTS.fontSize + 2, 'The default editor font size (with adjustment) should be used when terminal.integrated.fontSize is not set');

		configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().fontSize, EDITOR_FONT_DEFAULTS.fontSize, 'The default editor font size should be used when terminal.integrated.fontSize is not set');
	});

	test('TerminalConfigHelper - getFont lineHeight 2', () => {
		const configurationService = new TestConfigurationService({
			editor: {
				fontFamily: 'foo',
				lineHeight: 1
			},
			terminal: {
				integrated: {
					fontFamily: 0,
					lineHeight: 2
				}
			}
		});
		let configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().lineHeight, 2, 'terminal.integrated.lineHeight should be selected over editor.lineHeight');
	});

	test('TerminalConfigHelper - getFont lineHeight 0', () => {
		const configurationService = new TestConfigurationService({
			editor: {
				fontFamily: 'foo',
				lineHeight: 1
			},
			terminal: {
				integrated: {
					fontFamily: 0,
					lineHeight: 0
				}
			}
		});
		let configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.getFont().lineHeight, 1, 'editor.lineHeight should be 1 when terminal.integrated.lineHeight not set');
	});

	test('TerminalConfigHelper - isMonospace monospace', () => {
		const configurationService = new TestConfigurationService({
			terminal: {
				integrated: {
					fontFamily: 'monospace'
				}
			}
		});

		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.configFontIsMonospace(), true, 'monospace is monospaced');
	});

	test('TerminalConfigHelper - isMonospace sans-serif', () => {
		const configurationService = new TestConfigurationService({
			terminal: {
				integrated: {
					fontFamily: 'sans-serif'
				}
			}
		});
		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.configFontIsMonospace(), false, 'sans-serif is not monospaced');
	});

	test('TerminalConfigHelper - isMonospace serif', () => {
		const configurationService = new TestConfigurationService({
			terminal: {
				integrated: {
					fontFamily: 'serif'
				}
			}
		});
		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.configFontIsMonospace(), false, 'serif is not monospaced');
	});

	test('TerminalConfigHelper - isMonospace monospace falls back to editor.fontFamily', () => {
		const configurationService = new TestConfigurationService({
			editor: {
				fontFamily: 'monospace'
			},
			terminal: {
				integrated: {
					fontFamily: null
				}
			}
		});

		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.configFontIsMonospace(), true, 'monospace is monospaced');
	});

	test('TerminalConfigHelper - isMonospace sans-serif falls back to editor.fontFamily', () => {
		const configurationService = new TestConfigurationService({
			editor: {
				fontFamily: 'sans-serif'
			},
			terminal: {
				integrated: {
					fontFamily: null
				}
			}
		});

		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.configFontIsMonospace(), false, 'sans-serif is not monospaced');
	});

	test('TerminalConfigHelper - isMonospace serif falls back to editor.fontFamily', () => {
		const configurationService = new TestConfigurationService({
			editor: {
				fontFamily: 'serif'
			},
			terminal: {
				integrated: {
					fontFamily: null
				}
			}
		});

		const configHelper = new TestTerminalConfigHelper(configurationService, null!, null!, null!, null!);
		configHelper.panelContainer = fixture;
		assert.strictEqual(configHelper.configFontIsMonospace(), false, 'serif is not monospaced');
	});
});

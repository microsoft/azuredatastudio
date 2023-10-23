/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { EDITOR_FONT_DEFAULTS, IEditorOptions } from 'vs/editor/common/config/editorOptions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITerminalConfiguration, TERMINAL_CONFIG_SECTION, DEFAULT_LETTER_SPACING, DEFAULT_LINE_HEIGHT, MINIMUM_LETTER_SPACING, MINIMUM_FONT_WEIGHT, MAXIMUM_FONT_WEIGHT, DEFAULT_FONT_WEIGHT, DEFAULT_BOLD_FONT_WEIGHT, FontWeight, ITerminalFont } from 'vs/workbench/contrib/terminal/common/terminal';
import Severity from 'vs/base/common/severity';
import { INotificationService, NeverShowAgainScope } from 'vs/platform/notification/common/notification';
import { IBrowserTerminalConfigHelper, LinuxDistro } from 'vs/workbench/contrib/terminal/browser/terminal';
import { Emitter, Event } from 'vs/base/common/event';
import { basename } from 'vs/base/common/path';
import { IExtensionManagementService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { InstallRecommendedExtensionAction } from 'vs/workbench/contrib/extensions/browser/extensionsActions';
import { IProductService } from 'vs/platform/product/common/productService';
import { IXtermCore } from 'vs/workbench/contrib/terminal/browser/xterm-private';
import { IShellLaunchConfig } from 'vs/platform/terminal/common/terminal';
import { isLinux, isWindows } from 'vs/base/common/platform';
import { Disposable } from 'vs/base/common/lifecycle';

const enum FontConstants {
	MinimumFontSize = 6,
	MaximumFontSize = 100,
}

/**
 * Encapsulates terminal configuration logic, the primary purpose of this file is so that platform
 * specific test cases can be written.
 */
export class TerminalConfigHelper extends Disposable implements IBrowserTerminalConfigHelper {
	panelContainer: HTMLElement | undefined;

	private _charMeasureElement: HTMLElement | undefined;
	private _lastFontMeasurement: ITerminalFont | undefined;
	protected _linuxDistro: LinuxDistro = LinuxDistro.Unknown;
	config!: ITerminalConfiguration;

	private readonly _onConfigChanged = this._register(new Emitter<void>());
	get onConfigChanged(): Event<void> { return this._onConfigChanged.event; }

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IExtensionManagementService private readonly _extensionManagementService: IExtensionManagementService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IProductService private readonly _productService: IProductService,
	) {
		super();
		this._updateConfig();
		this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(TERMINAL_CONFIG_SECTION)) {
				this._updateConfig();
			}
		});
		if (isLinux) {
			if (navigator.userAgent.includes('Ubuntu')) {
				this._linuxDistro = LinuxDistro.Ubuntu;
			} else if (navigator.userAgent.includes('Fedora')) {
				this._linuxDistro = LinuxDistro.Fedora;
			}
		}
	}

	private _updateConfig(): void {
		const configValues = this._configurationService.getValue<ITerminalConfiguration>(TERMINAL_CONFIG_SECTION);
		configValues.fontWeight = this._normalizeFontWeight(configValues.fontWeight, DEFAULT_FONT_WEIGHT);
		configValues.fontWeightBold = this._normalizeFontWeight(configValues.fontWeightBold, DEFAULT_BOLD_FONT_WEIGHT);

		this.config = configValues;
		this._onConfigChanged.fire();
	}

	configFontIsMonospace(): boolean {
		const fontSize = 15;
		const fontFamily = this.config.fontFamily || this._configurationService.getValue<IEditorOptions>('editor').fontFamily || EDITOR_FONT_DEFAULTS.fontFamily;
		const iRect = this._getBoundingRectFor('i', fontFamily, fontSize);
		const wRect = this._getBoundingRectFor('w', fontFamily, fontSize);

		// Check for invalid bounds, there is no reason to believe the font is not monospace
		if (!iRect || !wRect || !iRect.width || !wRect.width) {
			return true;
		}

		return iRect.width === wRect.width;
	}

	private _createCharMeasureElementIfNecessary(): HTMLElement {
		if (!this.panelContainer) {
			throw new Error('Cannot measure element when terminal is not attached');
		}
		// Create charMeasureElement if it hasn't been created or if it was orphaned by its parent
		if (!this._charMeasureElement || !this._charMeasureElement.parentElement) {
			this._charMeasureElement = document.createElement('div');
			this.panelContainer.appendChild(this._charMeasureElement);
		}
		return this._charMeasureElement;
	}

	private _getBoundingRectFor(char: string, fontFamily: string, fontSize: number): ClientRect | DOMRect | undefined {
		let charMeasureElement: HTMLElement;
		try {
			charMeasureElement = this._createCharMeasureElementIfNecessary();
		} catch {
			return undefined;
		}
		const style = charMeasureElement.style;
		style.display = 'inline-block';
		style.fontFamily = fontFamily;
		style.fontSize = fontSize + 'px';
		style.lineHeight = 'normal';
		charMeasureElement.innerText = char;
		const rect = charMeasureElement.getBoundingClientRect();
		style.display = 'none';

		return rect;
	}

	private _measureFont(fontFamily: string, fontSize: number, letterSpacing: number, lineHeight: number): ITerminalFont {
		const rect = this._getBoundingRectFor('X', fontFamily, fontSize);

		// Bounding client rect was invalid, use last font measurement if available.
		if (this._lastFontMeasurement && (!rect || !rect.width || !rect.height)) {
			return this._lastFontMeasurement;
		}

		this._lastFontMeasurement = {
			fontFamily,
			fontSize,
			letterSpacing,
			lineHeight,
			charWidth: 0,
			charHeight: 0
		};

		if (rect && rect.width && rect.height) {
			this._lastFontMeasurement.charHeight = Math.ceil(rect.height);
			// Char width is calculated differently for DOM and the other renderer types. Refer to
			// how each renderer updates their dimensions in xterm.js
			if (this.config.gpuAcceleration === 'off') {
				this._lastFontMeasurement.charWidth = rect.width;
			} else {
				const deviceCharWidth = Math.floor(rect.width * window.devicePixelRatio);
				const deviceCellWidth = deviceCharWidth + Math.round(letterSpacing);
				const cssCellWidth = deviceCellWidth / window.devicePixelRatio;
				this._lastFontMeasurement.charWidth = cssCellWidth - Math.round(letterSpacing) / window.devicePixelRatio;
			}
		}

		return this._lastFontMeasurement;
	}

	/**
	 * Gets the font information based on the terminal.integrated.fontFamily
	 * terminal.integrated.fontSize, terminal.integrated.lineHeight configuration properties
	 */
	getFont(xtermCore?: IXtermCore, excludeDimensions?: boolean): ITerminalFont {
		const editorConfig = this._configurationService.getValue<IEditorOptions>('editor');

		let fontFamily = this.config.fontFamily || editorConfig.fontFamily || EDITOR_FONT_DEFAULTS.fontFamily;
		let fontSize = this._clampInt(this.config.fontSize, FontConstants.MinimumFontSize, FontConstants.MaximumFontSize, EDITOR_FONT_DEFAULTS.fontSize);

		// Work around bad font on Fedora/Ubuntu
		if (!this.config.fontFamily) {
			if (this._linuxDistro === LinuxDistro.Fedora) {
				fontFamily = '\'DejaVu Sans Mono\'';
			}
			if (this._linuxDistro === LinuxDistro.Ubuntu) {
				fontFamily = '\'Ubuntu Mono\'';

				// Ubuntu mono is somehow smaller, so set fontSize a bit larger to get the same perceived size.
				fontSize = this._clampInt(fontSize + 2, FontConstants.MinimumFontSize, FontConstants.MaximumFontSize, EDITOR_FONT_DEFAULTS.fontSize);
			}
		}

		// Always fallback to monospace, otherwise a proportional font may become the default
		fontFamily += ', monospace';

		const letterSpacing = this.config.letterSpacing ? Math.max(Math.floor(this.config.letterSpacing), MINIMUM_LETTER_SPACING) : DEFAULT_LETTER_SPACING;
		const lineHeight = this.config.lineHeight ? Math.max(this.config.lineHeight, 1) : DEFAULT_LINE_HEIGHT;

		if (excludeDimensions) {
			return {
				fontFamily,
				fontSize,
				letterSpacing,
				lineHeight
			};
		}

		// Get the character dimensions from xterm if it's available
		if (xtermCore) {
			if (xtermCore._renderService && xtermCore._renderService.dimensions?.css.cell.width && xtermCore._renderService.dimensions?.css.cell.height) {
				return {
					fontFamily,
					fontSize,
					letterSpacing,
					lineHeight,
					charHeight: xtermCore._renderService.dimensions.css.cell.height / lineHeight,
					charWidth: xtermCore._renderService.dimensions.css.cell.width - Math.round(letterSpacing) / window.devicePixelRatio
				};
			}
		}

		// Fall back to measuring the font ourselves
		return this._measureFont(fontFamily, fontSize, letterSpacing, lineHeight);
	}

	private _clampInt<T>(source: any, minimum: number, maximum: number, fallback: T): number | T {
		let r = parseInt(source, 10);
		if (isNaN(r)) {
			return fallback;
		}
		if (typeof minimum === 'number') {
			r = Math.max(minimum, r);
		}
		if (typeof maximum === 'number') {
			r = Math.min(maximum, r);
		}
		return r;
	}

	private _recommendationsShown = false;

	async showRecommendations(shellLaunchConfig: IShellLaunchConfig): Promise<void> {
		if (this._recommendationsShown) {
			return;
		}
		this._recommendationsShown = true;

		if (isWindows && shellLaunchConfig.executable && basename(shellLaunchConfig.executable).toLowerCase() === 'wsl.exe') {
			const exeBasedExtensionTips = this._productService.exeBasedExtensionTips;
			if (!exeBasedExtensionTips || !exeBasedExtensionTips.wsl) {
				return;
			}
			const extId = Object.keys(exeBasedExtensionTips.wsl.recommendations).find(extId => exeBasedExtensionTips.wsl.recommendations[extId].important);
			if (extId && ! await this._isExtensionInstalled(extId)) {
				this._notificationService.prompt(
					Severity.Info,
					nls.localize(
						'useWslExtension.title', "The '{0}' extension is recommended for opening a terminal in WSL.", exeBasedExtensionTips.wsl.friendlyName),
					[
						{
							label: nls.localize('install', 'Install'),
							run: () => {
								this._instantiationService.createInstance(InstallRecommendedExtensionAction, extId).run();
							}
						}
					],
					{
						sticky: true,
						neverShowAgain: { id: 'terminalConfigHelper/launchRecommendationsIgnore', scope: NeverShowAgainScope.APPLICATION },
						onCancel: () => { }
					}
				);
			}
		}
	}

	private async _isExtensionInstalled(id: string): Promise<boolean> {
		const extensions = await this._extensionManagementService.getInstalled();
		return extensions.some(e => e.identifier.id === id);
	}

	private _normalizeFontWeight(input: any, defaultWeight: FontWeight): FontWeight {
		if (input === 'normal' || input === 'bold') {
			return input;
		}
		return this._clampInt(input, MINIMUM_FONT_WEIGHT, MAXIMUM_FONT_WEIGHT, defaultWeight);
	}
}

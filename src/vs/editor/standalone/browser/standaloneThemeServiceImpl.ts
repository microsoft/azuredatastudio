/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { Color } from 'vs/base/common/color';
import { Emitter } from 'vs/base/common/event';
import { FontStyle, TokenizationRegistry, TokenMetadata } from 'vs/editor/common/modes';
import { ITokenThemeRule, TokenTheme, generateTokensCSSForColorMap } from 'vs/editor/common/modes/supports/tokenization';
import { BuiltinTheme, IStandaloneTheme, IStandaloneThemeData, IStandaloneThemeService } from 'vs/editor/standalone/common/standaloneThemeService';
import { hc_black, vs, vs_dark } from 'vs/editor/standalone/common/themes';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { Registry } from 'vs/platform/registry/common/platform';
import { ColorIdentifier, Extensions, IColorRegistry } from 'vs/platform/theme/common/colorRegistry';
import { Extensions as ThemingExtensions, ICssStyleCollector, IFileIconTheme, IThemingRegistry, ITokenStyle } from 'vs/platform/theme/common/themeService';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { ColorScheme } from 'vs/platform/theme/common/theme';
import { getIconsStyleSheet } from 'vs/platform/theme/browser/iconsStyleSheet';

const VS_THEME_NAME = 'vs';
const VS_DARK_THEME_NAME = 'vs-dark';
const HC_BLACK_THEME_NAME = 'hc-black';

const colorRegistry = Registry.as<IColorRegistry>(Extensions.ColorContribution);
const themingRegistry = Registry.as<IThemingRegistry>(ThemingExtensions.ThemingContribution);

class StandaloneTheme implements IStandaloneTheme {

	public readonly id: string;
	public readonly themeName: string;

	private readonly themeData: IStandaloneThemeData;
	private colors: Map<string, Color> | null;
	private readonly defaultColors: { [colorId: string]: Color | undefined; };
	private _tokenTheme: TokenTheme | null;

	constructor(name: string, standaloneThemeData: IStandaloneThemeData) {
		this.themeData = standaloneThemeData;
		let base = standaloneThemeData.base;
		if (name.length > 0) {
			if (isBuiltinTheme(name)) {
				this.id = name;
			} else {
				this.id = base + ' ' + name;
			}
			this.themeName = name;
		} else {
			this.id = base;
			this.themeName = base;
		}
		this.colors = null;
		this.defaultColors = Object.create(null);
		this._tokenTheme = null;
	}

	public get label(): string {
		return this.themeName;
	}

	public get base(): string {
		return this.themeData.base;
	}

	public notifyBaseUpdated() {
		if (this.themeData.inherit) {
			this.colors = null;
			this._tokenTheme = null;
		}
	}

	private getColors(): Map<string, Color> {
		if (!this.colors) {
			const colors = new Map<string, Color>();
			for (let id in this.themeData.colors) {
				colors.set(id, Color.fromHex(this.themeData.colors[id]));
			}
			if (this.themeData.inherit) {
				let baseData = getBuiltinRules(this.themeData.base);
				for (let id in baseData.colors) {
					if (!colors.has(id)) {
						colors.set(id, Color.fromHex(baseData.colors[id]));
					}
				}
			}
			this.colors = colors;
		}
		return this.colors;
	}

	public getColor(colorId: ColorIdentifier, useDefault?: boolean): Color | undefined {
		const color = this.getColors().get(colorId);
		if (color) {
			return color;
		}
		if (useDefault !== false) {
			return this.getDefault(colorId);
		}
		return undefined;
	}

	private getDefault(colorId: ColorIdentifier): Color | undefined {
		let color = this.defaultColors[colorId];
		if (color) {
			return color;
		}
		color = colorRegistry.resolveDefaultColor(colorId, this);
		this.defaultColors[colorId] = color;
		return color;
	}

	public defines(colorId: ColorIdentifier): boolean {
		return Object.prototype.hasOwnProperty.call(this.getColors(), colorId);
	}

	public get type(): ColorScheme {
		switch (this.base) {
			case VS_THEME_NAME: return ColorScheme.LIGHT;
			case HC_BLACK_THEME_NAME: return ColorScheme.HIGH_CONTRAST;
			default: return ColorScheme.DARK;
		}
	}

	public get tokenTheme(): TokenTheme {
		if (!this._tokenTheme) {
			let rules: ITokenThemeRule[] = [];
			let encodedTokensColors: string[] = [];
			if (this.themeData.inherit) {
				let baseData = getBuiltinRules(this.themeData.base);
				rules = baseData.rules;
				if (baseData.encodedTokensColors) {
					encodedTokensColors = baseData.encodedTokensColors;
				}
			}
			rules = rules.concat(this.themeData.rules);
			if (this.themeData.encodedTokensColors) {
				encodedTokensColors = this.themeData.encodedTokensColors;
			}
			this._tokenTheme = TokenTheme.createFromRawTokenTheme(rules, encodedTokensColors);
		}
		return this._tokenTheme;
	}

	public getTokenStyleMetadata(type: string, modifiers: string[], modelLanguage: string): ITokenStyle | undefined {
		// use theme rules match
		const style = this.tokenTheme._match([type].concat(modifiers).join('.'));
		const metadata = style.metadata;
		const foreground = TokenMetadata.getForeground(metadata);
		const fontStyle = TokenMetadata.getFontStyle(metadata);
		return {
			foreground: foreground,
			italic: Boolean(fontStyle & FontStyle.Italic),
			bold: Boolean(fontStyle & FontStyle.Bold),
			underline: Boolean(fontStyle & FontStyle.Underline)
		};
	}

	public get tokenColorMap(): string[] {
		return [];
	}

	public readonly semanticHighlighting = false;
}

function isBuiltinTheme(themeName: string): themeName is BuiltinTheme {
	return (
		themeName === VS_THEME_NAME
		|| themeName === VS_DARK_THEME_NAME
		|| themeName === HC_BLACK_THEME_NAME
	);
}

function getBuiltinRules(builtinTheme: BuiltinTheme): IStandaloneThemeData {
	switch (builtinTheme) {
		case VS_THEME_NAME:
			return vs;
		case VS_DARK_THEME_NAME:
			return vs_dark;
		case HC_BLACK_THEME_NAME:
			return hc_black;
	}
}

function newBuiltInTheme(builtinTheme: BuiltinTheme): StandaloneTheme {
	let themeData = getBuiltinRules(builtinTheme);
	return new StandaloneTheme(builtinTheme, themeData);
}

export class StandaloneThemeServiceImpl extends Disposable implements IStandaloneThemeService {

	declare readonly _serviceBrand: undefined;

	private readonly _onColorThemeChange = this._register(new Emitter<IStandaloneTheme>());
	public readonly onDidColorThemeChange = this._onColorThemeChange.event;

	private readonly _onFileIconThemeChange = this._register(new Emitter<IFileIconTheme>());
	public readonly onDidFileIconThemeChange = this._onFileIconThemeChange.event;

	private readonly _environment: IEnvironmentService = Object.create(null);
	private readonly _knownThemes: Map<string, StandaloneTheme>;
	private _autoDetectHighContrast: boolean;
	private _codiconCSS: string;
	private _themeCSS: string;
	private _allCSS: string;
	private _globalStyleElement: HTMLStyleElement | null;
	private _styleElements: HTMLStyleElement[];
	private _colorMapOverride: Color[] | null;
	private _desiredTheme!: IStandaloneTheme;
	private _theme!: IStandaloneTheme;

	constructor() {
		super();

		this._autoDetectHighContrast = true;

		this._knownThemes = new Map<string, StandaloneTheme>();
		this._knownThemes.set(VS_THEME_NAME, newBuiltInTheme(VS_THEME_NAME));
		this._knownThemes.set(VS_DARK_THEME_NAME, newBuiltInTheme(VS_DARK_THEME_NAME));
		this._knownThemes.set(HC_BLACK_THEME_NAME, newBuiltInTheme(HC_BLACK_THEME_NAME));

		const iconsStyleSheet = getIconsStyleSheet();

		this._codiconCSS = iconsStyleSheet.getCSS();
		this._themeCSS = '';
		this._allCSS = `${this._codiconCSS}\n${this._themeCSS}`;
		this._globalStyleElement = null;
		this._styleElements = [];
		this._colorMapOverride = null;
		this.setTheme(VS_THEME_NAME);

		iconsStyleSheet.onDidChange(() => {
			this._codiconCSS = iconsStyleSheet.getCSS();
			this._updateCSS();
		});

		dom.addMatchMediaChangeListener('(forced-colors: active)', () => {
			this._updateActualTheme();
		});
	}

	public registerEditorContainer(domNode: HTMLElement): IDisposable {
		if (dom.isInShadowDOM(domNode)) {
			return this._registerShadowDomContainer(domNode);
		}
		return this._registerRegularEditorContainer();
	}

	private _registerRegularEditorContainer(): IDisposable {
		if (!this._globalStyleElement) {
			this._globalStyleElement = dom.createStyleSheet();
			this._globalStyleElement.className = 'monaco-colors';
			this._globalStyleElement.textContent = this._allCSS;
			this._styleElements.push(this._globalStyleElement);
		}
		return Disposable.None;
	}

	private _registerShadowDomContainer(domNode: HTMLElement): IDisposable {
		const styleElement = dom.createStyleSheet(domNode);
		styleElement.className = 'monaco-colors';
		styleElement.textContent = this._allCSS;
		this._styleElements.push(styleElement);
		return {
			dispose: () => {
				for (let i = 0; i < this._styleElements.length; i++) {
					if (this._styleElements[i] === styleElement) {
						this._styleElements.splice(i, 1);
						return;
					}
				}
			}
		};
	}

	public defineTheme(themeName: string, themeData: IStandaloneThemeData): void {
		if (!/^[a-z0-9\-]+$/i.test(themeName)) {
			throw new Error('Illegal theme name!');
		}
		if (!isBuiltinTheme(themeData.base) && !isBuiltinTheme(themeName)) {
			throw new Error('Illegal theme base!');
		}
		// set or replace theme
		this._knownThemes.set(themeName, new StandaloneTheme(themeName, themeData));

		if (isBuiltinTheme(themeName)) {
			this._knownThemes.forEach(theme => {
				if (theme.base === themeName) {
					theme.notifyBaseUpdated();
				}
			});
		}
		if (this._theme.themeName === themeName) {
			this.setTheme(themeName); // refresh theme
		}
	}

	public getColorTheme(): IStandaloneTheme {
		return this._theme;
	}

	public setColorMapOverride(colorMapOverride: Color[] | null): void {
		this._colorMapOverride = colorMapOverride;
		this._updateThemeOrColorMap();
	}

	public setTheme(themeName: string): void {
		let theme: StandaloneTheme;
		if (this._knownThemes.has(themeName)) {
			theme = this._knownThemes.get(themeName)!;
		} else {
			theme = this._knownThemes.get(VS_THEME_NAME)!;
		}
		this._desiredTheme = theme;
		this._updateActualTheme();
	}

	private _updateActualTheme(): void {
		const theme = (
			this._autoDetectHighContrast && window.matchMedia(`(forced-colors: active)`).matches
				? this._knownThemes.get(HC_BLACK_THEME_NAME)!
				: this._desiredTheme
		);
		if (this._theme === theme) {
			// Nothing to do
			return;
		}
		this._theme = theme;
		this._updateThemeOrColorMap();
	}

	public setAutoDetectHighContrast(autoDetectHighContrast: boolean): void {
		this._autoDetectHighContrast = autoDetectHighContrast;
		this._updateActualTheme();
	}

	private _updateThemeOrColorMap(): void {
		let cssRules: string[] = [];
		let hasRule: { [rule: string]: boolean; } = {};
		let ruleCollector: ICssStyleCollector = {
			addRule: (rule: string) => {
				if (!hasRule[rule]) {
					cssRules.push(rule);
					hasRule[rule] = true;
				}
			}
		};
		themingRegistry.getThemingParticipants().forEach(p => p(this._theme, ruleCollector, this._environment));

		const colorMap = this._colorMapOverride || this._theme.tokenTheme.getColorMap();
		ruleCollector.addRule(generateTokensCSSForColorMap(colorMap));

		this._themeCSS = cssRules.join('\n');
		this._updateCSS();

		TokenizationRegistry.setColorMap(colorMap);
		this._onColorThemeChange.fire(this._theme);
	}

	private _updateCSS(): void {
		this._allCSS = `${this._codiconCSS}\n${this._themeCSS}`;
		this._styleElements.forEach(styleElement => styleElement.textContent = this._allCSS);
	}

	public getFileIconTheme(): IFileIconTheme {
		return {
			hasFileIcons: false,
			hasFolderIcons: false,
			hidesExplorerArrows: false
		};
	}
}

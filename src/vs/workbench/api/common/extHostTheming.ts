/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ColorTheme, ColorThemeKind } from './extHostTypes';
import { IExtHostRpcService } from 'vs/workbench/api/common/extHostRpcService';
import { ExtHostThemingShape } from 'vs/workbench/api/common/extHost.protocol';
import { Emitter, Event } from 'vs/base/common/event';

export class ExtHostTheming implements ExtHostThemingShape {

	readonly _serviceBrand: undefined;

	private _actual: ColorTheme;
	private _onDidChangeActiveColorTheme: Emitter<ColorTheme>;

	constructor(
		@IExtHostRpcService _extHostRpc: IExtHostRpcService
	) {
		this._actual = new ColorTheme(ColorThemeKind.Dark);
		this._onDidChangeActiveColorTheme = new Emitter<ColorTheme>();
	}

	public get activeColorTheme(): ColorTheme {
		return this._actual;
	}

	$onColorThemeChange(type: string): void {
		let kind;
		switch (type) {
			case 'light': kind = ColorThemeKind.Light; break;
			case 'hcDark': kind = ColorThemeKind.HighContrast; break;
			case 'hcLight': kind = ColorThemeKind.HighContrastLight; break;
			default:
				kind = ColorThemeKind.Dark;
		}
		this._actual = new ColorTheme(kind);
		this._onDidChangeActiveColorTheme.fire(this._actual);
	}

	public get onDidChangeActiveColorTheme(): Event<ColorTheme> {
		return this._onDidChangeActiveColorTheme.event;
	}
}

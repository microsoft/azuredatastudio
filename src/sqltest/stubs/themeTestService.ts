/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IThemeService, ITheme, IThemingParticipant, IIconTheme } from 'vs/platform/theme/common/themeService';
import { Color } from 'vs/base/common/color';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ColorIdentifier } from 'vs/platform/theme/common/colorRegistry';
import { Event } from 'vs/base/common/event';

export class TestTheme implements ITheme {
	selector: string;
	type: 'light' | 'dark' | 'hc';

	getColor(color: string, useDefault?: boolean): Color {
		return Color.white;
	}

	isDefault(color: string): boolean {
		throw new Error('Method not implemented.');
	}

	defines(color: ColorIdentifier): boolean {
		throw new Error('Method not implemented.');
	}
}

const testTheme = new TestTheme();

export class TestThemeService implements IThemeService {

	_serviceBrand: any;
	onIconThemeChange = Event.None;

	getTheme(): ITheme {
		return testTheme;
	}

	onThemeChange(participant: IThemingParticipant): IDisposable {
		return { dispose: () => { } };
	}

	getIconTheme(): IIconTheme {
		return undefined;
	}
}
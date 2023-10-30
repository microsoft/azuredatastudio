/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as cr from 'vs/platform/theme/common/colorRegistry';
import * as sqlcr from 'sql/platform/theme/common/colorRegistry';
import { IDisposable } from 'vs/base/common/lifecycle';

export function attachDesignerStyler(widget: any, themeService: IThemeService): IDisposable {
	function applyStyles(): void {
		const colorTheme = themeService.getColorTheme();
		widget.style({
			paneSeparator: cr.resolveColorValue(sqlcr.DesignerPaneSeparator, colorTheme),
		});
	}

	applyStyles();

	return themeService.onDidColorThemeChange(applyStyles);
}

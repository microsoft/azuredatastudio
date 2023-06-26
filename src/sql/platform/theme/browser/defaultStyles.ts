/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ICheckboxStyles } from 'sql/base/browser/ui/checkbox/checkbox';
import *  as sqlcr from 'sql/platform/theme/common/colorRegistry';
import { disabledCheckboxForeground } from 'sql/platform/theme/common/colors';
import { IButtonStyles } from 'vs/base/browser/ui/button/button';
import { IStyleOverride, overrideStyles } from 'vs/platform/theme/browser/defaultStyles';
import { asCssVariable } from 'vs/platform/theme/common/colorRegistry';


export const defaultCheckboxStyles: ICheckboxStyles = {
	disabledCheckboxForeground: asCssVariable(disabledCheckboxForeground)
};

export function getCheckboxStyles(override: IStyleOverride<ICheckboxStyles>): ICheckboxStyles {
	return overrideStyles(override, defaultCheckboxStyles);
}

export const defaultInfoButtonStyles: IButtonStyles = {
	buttonBackground: asCssVariable(sqlcr.infoButtonBackground),
	buttonForeground: asCssVariable(sqlcr.infoButtonForeground),
	buttonBorder: asCssVariable(sqlcr.infoButtonBorder),
	buttonHoverBackground: asCssVariable(sqlcr.infoButtonHoverBackground),
	buttonSeparator: undefined,
	buttonSecondaryBackground: undefined,
	buttonSecondaryForeground: undefined,
	buttonSecondaryHoverBackground: undefined,
	buttonSecondaryBorder: undefined,
	buttonDisabledBackground: undefined,
	buttonDisabledForeground: undefined,
	buttonDisabledBorder: undefined
}

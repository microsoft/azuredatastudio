/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ICheckboxStyles } from 'sql/base/browser/ui/checkbox/checkbox';
import { disabledCheckboxForeground } from 'sql/platform/theme/common/colors';
import { IStyleOverride, overrideStyles } from 'vs/platform/theme/browser/defaultStyles';
import { asCssVariable } from 'vs/platform/theme/common/colorRegistry';


export const defaultCheckboxStyles: ICheckboxStyles = {
	disabledCheckboxForeground: asCssVariable(disabledCheckboxForeground)
};

export function getCheckboxStyles(override: IStyleOverride<ICheckboxStyles>): ICheckboxStyles {
	return overrideStyles(override, defaultCheckboxStyles);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerColor, foreground } from 'vs/platform/theme/common/colorRegistry';
import { Color, RGBA } from 'vs/base/common/color';
import * as nls from 'vs/nls';

export const tableHeaderBackground = registerColor('table.headerBackground', { dark: new Color(new RGBA(51, 51, 52)), light: new Color(new RGBA(245, 245, 245)), hc: '#333334' }, nls.localize('tableHeaderBackground', 'Table header background color'));
export const tableHeaderForeground = registerColor('table.headerForeground', { dark: new Color(new RGBA(229, 229, 229)), light: new Color(new RGBA(16, 16, 16)), hc: '#e5e5e5' }, nls.localize('tableHeaderForeground', 'Table header foreground color'));
export const disabledInputBackground = registerColor('input.disabled.background', { dark: '#444444', light: '#dcdcdc', hc: Color.black }, nls.localize('disabledInputBoxBackground', "Disabled Input box background."));
export const disabledInputForeground = registerColor('input.disabled.foreground', { dark: '#888888', light: '#888888', hc: foreground }, nls.localize('disabledInputBoxForeground', "Disabled Input box foreground."));
export const buttonFocusOutline = registerColor('button.focusOutline', { dark: '#eaeaea', light: '#666666', hc: null }, nls.localize('buttonFocusOutline', "Button outline color when focused."));

export const listFocusAndSelectionBackground = registerColor('list.focusAndSelectionBackground', { dark: '#2c3295', light: '#2c3295', hc: null }, nls.localize('listFocusAndSelectionBackground', "List/Table background color for the selected and focus item when the list/table is active"));
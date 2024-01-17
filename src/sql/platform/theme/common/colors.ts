/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerColor, foreground, activeContrastBorder, contrastBorder } from 'vs/platform/theme/common/colorRegistry';
import { Color, RGBA } from 'vs/base/common/color';
import * as nls from 'vs/nls';

export const tableHeaderBackground = registerColor('table.headerBackground', { dark: new Color(new RGBA(51, 51, 52)), light: new Color(new RGBA(245, 245, 245)), hcDark: '#333334', hcLight: '#fff' }, nls.localize('tableHeaderBackground', "Table header background color"));
export const tableHeaderForeground = registerColor('table.headerForeground', { dark: new Color(new RGBA(229, 229, 229)), light: new Color(new RGBA(16, 16, 16)), hcDark: '#e5e5e5', hcLight: '#000' }, nls.localize('tableHeaderForeground', "Table header foreground color"));
export const listFocusAndSelectionBackground = registerColor('list.focusAndSelectionBackground', { dark: '#2c3295', light: '#2c3295', hcDark: null, hcLight: null }, nls.localize('listFocusAndSelectionBackground', "List/Table background color for the selected and focus item when the list/table is active"));
export const listFocusAndSelectionForeground = registerColor('list.focusAndSelectionForeground', { dark: '#ffffff', light: '#ffffff', hcDark: null, hcLight: null }, nls.localize('listFocusAndSelectionBackground', "List/Table foreground color for the selected and focus item when the list/table is active"));
export const tableCellOutline = registerColor('table.cell.outline', { dark: '#e3e4e229', light: '#33333333', hcDark: '#e3e4e229', hcLight: '#e3e4e229' }, nls.localize('tableCellOutline', 'Color of the outline of a cell.'));

export const disabledInputBackground = registerColor('input.disabled.background', { dark: '#444444', light: '#dcdcdc', hcDark: Color.black, hcLight: Color.white }, nls.localize('disabledInputBoxBackground', "Disabled Input box background."));
export const disabledInputForeground = registerColor('input.disabled.foreground', { dark: '#888888', light: '#888888', hcDark: foreground, hcLight: foreground }, nls.localize('disabledInputBoxForeground', "Disabled Input box foreground."));
export const buttonFocusOutline = registerColor('button.focusOutline', { dark: '#eaeaea', light: '#666666', hcDark: null, hcLight: activeContrastBorder }, nls.localize('buttonFocusOutline', "Button outline color when focused."));
export const disabledCheckboxForeground = registerColor('checkbox.disabled.foreground', { dark: '#888888', light: '#888888', hcDark: Color.black, hcLight: Color.white }, nls.localize('disabledCheckboxforeground', "Disabled checkbox foreground."));


// SQL Agent Colors
export const tableBackground = registerColor('agent.tableBackground', { light: '#fffffe', dark: '#333333', hcDark: Color.black, hcLight: Color.white }, nls.localize('agentTableBackground', "SQL Agent Table background color."));
export const cellBackground = registerColor('agent.cellBackground', { light: '#faf5f8', dark: Color.black, hcDark: Color.black, hcLight: Color.white }, nls.localize('agentCellBackground', "SQL Agent table cell background color."));
export const tableHoverBackground = registerColor('agent.tableHoverColor', { light: '#dcdcdc', dark: '#444444', hcDark: null, hcLight: null }, nls.localize('agentTableHoverBackground', "SQL Agent table hover background color."));
export const jobsHeadingBackground = registerColor('agent.jobsHeadingColor', { light: '#f4f4f4', dark: '#444444', hcDark: '#2b56f2', hcLight: '#ffffff' }, nls.localize('agentJobsHeadingColor', "SQL Agent heading background color."));
export const cellBorderColor = registerColor('agent.cellBorderColor', { light: null, dark: null, hcDark: contrastBorder, hcLight: contrastBorder }, nls.localize('agentCellBorderColor', "SQL Agent table cell border color."));

export const resultsErrorColor = registerColor('results.error.color', { light: '#f44242', dark: '#f44242', hcDark: '#f44242', hcLight: '#f44242' }, nls.localize('resultsErrorColor', "Results messages error color."));

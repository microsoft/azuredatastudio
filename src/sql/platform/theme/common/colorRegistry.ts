/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerColor, transparent } from 'vs/platform/theme/common/colorRegistry';
import { Color } from 'vs/base/common/color';
import * as nls from 'vs/nls';

// ----- base colors

export const focusBorder = registerColor('focusBorder', { dark: Color.fromHex('#0E639C').transparent(0.8), light: Color.fromHex('#007ACC').transparent(0.4), hc: '#F38518' }, nls.localize('focusBorder', "Overall border color for focused elements. This color is only used if not overridden by a component."));
export const foreground = registerColor('foreground', { dark: '#CCCCCC', light: '#616161', hc: '#FFFFFF' }, nls.localize('foreground', "Overall foreground color. This color is only used if not overridden by a component."));
export const descriptionForeground = registerColor('descriptionForeground', { light: '#717171', dark: transparent(foreground, 0.7), hc: transparent(foreground, 0.7) }, nls.localize('descriptionForeground', "Foreground color for description text providing additional information, for example for a label."));

export const contrastBorder = registerColor('contrastBorder', { light: null, dark: null, hc: '#2b56f2' }, nls.localize('contrastBorder', "An extra border around elements to separate them from others for greater contrast."));
export const activeContrastBorder = registerColor('contrastActiveBorder', { light: null, dark: null, hc: focusBorder }, nls.localize('activeContrastBorder', "An extra border around active elements to separate them from others for greater contrast."));

// ----- text colors

export const textLinkActiveForeground = registerColor('textLink.activeForeground', { light: '#006AB1', dark: '#3794FF', hc: '#3794FF' }, nls.localize('textLinkActiveForeground', "Foreground color for links in text when clicked on and on mouse hover."));


// -- Welcome Page Colors
export const tileBackground = registerColor('tileBackground', { light: '#fff', dark: '#1B1A19', hc: '#1B1A19' }, nls.localize('tileBackground', "The background color of tiles"));
export const tileBorder = registerColor('tileBorder', { light: '#fff', dark: '#8A8886', hc: '#2B56F2' }, nls.localize('tileBorder', "The background color of tiles"));
export const buttonStandardBorder = registerColor('buttonStandardBorder', { light: '#8A8886', dark: '#FFF', hc: '#264BD3' }, nls.localize('buttonStandardBorder', "The border color for standard button"));
export const buttonStandardBackground = registerColor('buttonStandardBackground', { light: '#FFF', dark: '#1B1A19', hc: '#1B1A19' }, nls.localize('buttonStandardBackground', "The background color for the standard button"));
export const buttonStandard = registerColor('buttonStandard', { light: '#323130', dark: '#fff', hc: '#fff' }, nls.localize('buttonStandard', "The font color for primary button"));
export const buttonStandardHoverColor = registerColor('buttonStandardHover', { light: '#0078D4', dark: '#3794ff', hc: '#3794ff' }, nls.localize('buttonStandardHover', "The hover color for standard buttons"));
export const welcomePath = registerColor('welcomePath', { light: '#323130', dark: '#fff', hc: '#fff' }, nls.localize('welcomePath', "The border color for primary button"));
export const welcomeFont = registerColor('welcomeFontColor', { light: '#323130', dark: '#fff', hc: '#fff' }, nls.localize('welcomeFontColor', "The border color for primary button"));
export const moreRecent = registerColor('moreRecent', { light: '#000', dark: '#fff', hc: '#fff' }, nls.localize('moreRecent', "The border color for primary button"));
export const entity = registerColor('entity', { light: '#000', dark: '#0078D4', hc: '#3AA0F3' }, nls.localize('entity', "The color for entity symbols"));
export const disabledButton = registerColor('disabledButton', { light: '#A19F9D', dark: '#797775', hc: '#797775' }, nls.localize('disabledButton', "The color for a standard disabled button"));
export const disabledButtonBackground = registerColor('disabledButtonBackground', { light: '#F3F2F1', dark: '#252423', hc: '#252423' }, nls.localize('disabledButtonBackground', "The background color for standard disabled button"));
export const welcomeLink = registerColor('welcomeLink', { light: '#0078d4', dark: '#3aa0f3', hc: '#3aa0f3' }, nls.localize('welcomeLink', "Foreground color for links in text."));


//registerColor, focusBorder, textLinkActiveForeground, foreground, descriptionForeground, contrastBorder, activeContrastBorder

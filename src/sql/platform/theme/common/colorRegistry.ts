/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerColor } from 'vs/platform/theme/common/colorRegistry';
import { Color, RGBA } from 'vs/base/common/color';
import * as nls from 'vs/nls';



export const tileBoxShadowColor = new Color(new RGBA(0, 1, 4, 0.13));
export const tileBoxShadowHoverColor = new Color(new RGBA(0, 3, 8, 0.14));
export const textShadow = new Color(new RGBA(0, 0, 0, 0.25));
export const dropdownBoxShadow = new Color(new RGBA(0, 0, 0, 0.25));
export const extensionPackGradientOne = new Color(new RGBA(50, 49, 48, 0.55));
export const extensionPackGradientTwo = new Color(new RGBA(50, 49, 48, 0));

// -- Welcome Page Colors
export const tileBackground = registerColor('tileBackground', { light: '#fff', dark: '#1B1A19', hc: '#1B1A19' }, nls.localize('tileBackground', "The background color of tiles"));
export const tileBorder = registerColor('tileBorder', { light: '#fff', dark: '#8A8886', hc: '#2B56F2' }, nls.localize('tileBorder', "The border color of tiles"));
export const tileBoxShadow = registerColor('tileBoxShadow', { light: tileBoxShadowColor, dark: tileBoxShadowColor, hc: tileBoxShadowColor }, nls.localize('tileBoxShadow', "The tile box shadow color"));
export const tileBoxShadowHover = registerColor('tileBoxShadowHover', { light: tileBoxShadowHoverColor, dark: tileBoxShadowHoverColor, hc: tileBoxShadowHoverColor }, nls.localize('tileBoxShadowHover', "The tile box shadow hover color"));
export const buttonStandardBorder = registerColor('buttonStandardBorder', { light: '#8A8886', dark: '#FFF', hc: '#264BD3' }, nls.localize('buttonStandardBorder', "The border color for standard button"));
export const buttonStandardBackground = registerColor('buttonStandardBackground', { light: '#FFF', dark: '#1B1A19', hc: '#1B1A19' }, nls.localize('buttonStandardBackground', "The background color for the standard button"));
export const buttonStandard = registerColor('buttonStandard', { light: '#323130', dark: '#fff', hc: '#fff' }, nls.localize('buttonStandard', "The font color for primary button"));
export const buttonStandardHoverColor = registerColor('buttonStandardHover', { light: '#0078D4', dark: '#3794ff', hc: '#3794ff' }, nls.localize('buttonStandardHover', "The hover color for standard buttons"));
export const buttonPrimaryBackground = registerColor('buttonPrimaryBackground', { light: '#0078d4', dark: '#0078d4', hc: '#0078d4' }, nls.localize('buttonPrimaryBackground', "The primary button background"));
export const buttonPrimaryBorder = registerColor('buttonPrimaryBorder', { light: '#0078d4', dark: '#0078d4', hc: '#0078d4' }, nls.localize('buttonPrimaryBorder', "The primary button border color"));
export const buttonPrimaryBackgroundHover = registerColor('buttonPrimaryBackgroundHover', { light: '#106ebe', dark: '#106ebe', hc: '#106ebe' }, nls.localize('buttonPrimaryBackgroundHover', "The primary button background hover color"));
export const buttonPrimaryBackgroundActive = registerColor('buttonPrimaryBackgroundActive', { light: '#005a9e', dark: '#005a9e', hc: '#005a9e' }, nls.localize('buttonPrimaryBackgroundActive', "The primary button background active color"));
export const buttonDropdownBoxShadow = registerColor('buttonDropdownBoxShadow', { light: dropdownBoxShadow, dark: dropdownBoxShadow, hc: dropdownBoxShadow }, nls.localize('buttonDropdownBoxShadow', "The button dropdown box shadow color"));
export const buttonDropdownBackgroundHover = registerColor('buttonDropdownBackgroundHover', { light: '#3062d6', dark: '#3062d6', hc: '#3062d6' }, nls.localize('buttonDropdownBackgroundHover', "The button dropdown background hover color"));
export const listLink = registerColor('listLink', { light: '#323130', dark: '#fff', hc: '#fff' }, nls.localize('listLink', "The list link color"));
export const listBorder = registerColor('listBorder', { light: '#ccc', dark: '#ccc', hc: '#ccc' }, nls.localize('listBorder', "The list item border"));
export const extensionPackHeaderShadow = registerColor('extensionPackHeaderShadow', { light: textShadow, dark: textShadow, hc: textShadow }, nls.localize('extensionPackHeaderShadow', "The extension pack header text shadowcolor"));
export const extensionPackGradientColorOneColor = registerColor('extensionPackGradientColorOne', { light: extensionPackGradientOne, dark: extensionPackGradientOne, hc: extensionPackGradientOne }, nls.localize('extensionPackGradientColorOne', "The top color for the extension pack gradient"));
export const extensionPackGradientColorTwoColor = registerColor('extensionPackGradientColorTwo', { light: extensionPackGradientTwo, dark: extensionPackGradientTwo, hc: extensionPackGradientTwo }, nls.localize('extensionPackGradientColorTwo', "The bottom color for the extension pack gradient"));
export const themedIcon = registerColor('themedIcon', { light: '#000', dark: '#fff', hc: '#fff' }, nls.localize('themedIcon', "The color for themed icons"));
export const themedAltIcon = registerColor('themedAltIcon', { light: '#0078d4', dark: '#0078d4', hc: '#0078d4' }, nls.localize('themedAltIcon', "The color for alternately themed icons"));

export const gradientOneColorOne = new Color(new RGBA(0, 0, 0, .2));

export const gradientTwoColorOne = new Color(new RGBA(156, 48, 48, 0));
export const gradientTwoColorTwo = new Color(new RGBA(255, 255, 255, 0.1));

export const gradientOne = registerColor('gradientOne', { light: '#f0f0f0', dark: gradientOneColorOne, hc: gradientOneColorOne }, nls.localize('gradientOne', "The top color for the banner image gradient"));
export const gradientTwo = registerColor('gradientTwo', { light: gradientTwoColorOne, dark: gradientTwoColorTwo, hc: gradientTwoColorTwo }, nls.localize('gradientTwo', "The bottom color for the banner image gradient"));
export const gradientBackground = registerColor('gradientBackground', { light: '#fff', dark: 'transparent', hc: 'transparent' }, nls.localize('gradientBackground', "The background color for the banner image gradient"));


export const welcomeFont = registerColor('welcomeFontColor', { light: '#323130', dark: '#fff', hc: '#fff' }, nls.localize('welcomeFontColor', "The color for fonts"));
export const entity = registerColor('entity', { light: '#000', dark: '#0078D4', hc: '#3AA0F3' }, nls.localize('entity', "The color for entity symbols"));
export const disabledButton = registerColor('disabledButton', { light: '#A19F9D', dark: '#797775', hc: '#797775' }, nls.localize('disabledButton', "The color for a standard disabled button"));
export const disabledButtonBackground = registerColor('disabledButtonBackground', { light: '#F3F2F1', dark: '#252423', hc: '#252423' }, nls.localize('disabledButtonBackground', "The background color for standard disabled button"));
export const welcomeLink = registerColor('welcomeLink', { light: '#0078d4', dark: '#0078d4', hc: '#3aa0f3' }, nls.localize('welcomeLink', "Foreground color for links in text."));
export const welcomeLinkActive = registerColor('welcomeLinkActive', { light: '#004578', dark: '#004578', hc: '#004578' }, nls.localize('welcomeLinkActive', "Foreground color for active links in text."));
export const welcomeLabel = registerColor('welcomeLabel', { light: '#0078d7', dark: '#0078d7', hc: '#0078d7' }, nls.localize('welcomeLabel', "The font color for label tags"));
export const welcomeLabelChecked = registerColor('welcomeLabel', { light: '#000', dark: '#fff', hc: '#fff' }, nls.localize('welcomeLabelChecked', "The font color for labels that have been checked"));
export const welcomeLabelBorder = registerColor('welcomeLabel', { light: '#000', dark: '#fff', hc: '#fff' }, nls.localize('welcomeLabelBorder', "The border color for labels"));
export const focusOutline = registerColor('focusOutline', { light: '#000', dark: '#fff', hc: '#fff' }, nls.localize('focusOutline', "The focus outline color"));

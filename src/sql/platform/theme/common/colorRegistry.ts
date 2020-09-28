/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerColor } from 'vs/platform/theme/common/colorRegistry';
import { Color, RGBA } from 'vs/base/common/color';
import * as nls from 'vs/nls';

// -- Welcome Page Colors
export const tileBoxShadowColor = new Color(new RGBA(0, 1, 4, 0.13));
export const textShadow = new Color(new RGBA(0, 0, 0, 0.25));
export const dropdownBoxShadow = new Color(new RGBA(0, 0, 0, 0.25));
export const extensionPackGradientOne = new Color(new RGBA(50, 49, 48, 0.55));
export const extensionPackGradientTwo = new Color(new RGBA(50, 49, 48, 0));
export const gradientOneColorOne = new Color(new RGBA(0, 0, 0, .2));
export const gradientTwoColorOne = new Color(new RGBA(156, 48, 48, 0));
export const gradientTwoColorTwo = new Color(new RGBA(255, 255, 255, 0.1));

// -- Tiles
export const tileBorder = registerColor('tileBorder', { light: '#fff', dark: '#8A8886', hc: '#2B56F2' }, nls.localize('tileBorder', "The border color of tiles"));
export const tileBoxShadow = registerColor('tileBoxShadow', { light: tileBoxShadowColor, dark: tileBoxShadowColor, hc: tileBoxShadowColor }, nls.localize('tileBoxShadow', "The tile box shadow color"));

// -- Buttons
export const buttonSecondaryBorder = registerColor('button.secondaryBorder', { light: '#8A8886', dark: '#FFF', hc: '#264BD3' }, nls.localize('button.secondaryBorder', "The border color for secondary button"));
export const buttonSecondaryBackground = registerColor('button.secondaryBackground', { light: null, dark: null, hc: null }, nls.localize('button.secondaryBackground', "The background color for the secondary button"));
export const buttonSecondary = registerColor('button.secondaryForeground', { light: '#323130', dark: '#fff', hc: '#fff' }, nls.localize('button.secondaryForeground', "The font color for secondary button"));
export const buttonSecondaryHoverColor = registerColor('button.secondaryHoverForeground', { light: '#0078D4', dark: '#3794ff', hc: '#3794ff' }, nls.localize('button.secondaryHoverForeground', "The hover color for secondary buttons"));
export const buttonSecondaryHoverBorder = registerColor('button.buttonSecondaryHoverBorder', { light: '#0078D4', dark: '#3794ff', hc: '#3794ff' }, nls.localize('button.buttonSecondaryHoverBorder', "The hover border color for secondary buttons"));
export const buttonDropdownBackgroundHover = registerColor('buttonDropdownBackgroundHover', { light: '#3062d6', dark: '#3062d6', hc: '#3062d6' }, nls.localize('buttonDropdownBackgroundHover', "The button dropdown background hover color"));
export const disabledButton = registerColor('button.disabledForeground', { light: '#A19F9D', dark: '#797775', hc: '#797775' }, nls.localize('button.disabledForeground', "The color for a secondary disabled button"));
export const disabledButtonBackground = registerColor('button.disabledBackground', { light: '#F3F2F1', dark: '#252423', hc: '#252423' }, nls.localize('button.disabledBackground', "The background color for secondary disabled button"));

// -- Shadows
export const hoverShadow = registerColor('buttonDropdownBoxShadow', { light: dropdownBoxShadow, dark: dropdownBoxShadow, hc: dropdownBoxShadow }, nls.localize('buttonDropdownBoxShadow', "The button dropdown box shadow color"));
export const extensionPackHeaderShadow = registerColor('extensionPackHeaderShadow', { light: textShadow, dark: textShadow, hc: textShadow }, nls.localize('extensionPackHeaderShadow', "The extension pack header text shadowcolor"));

// -- Gradients
export const extensionPackGradientColorOneColor = registerColor('extensionPackGradientColorOne', { light: extensionPackGradientOne, dark: extensionPackGradientOne, hc: extensionPackGradientOne }, nls.localize('extensionPackGradientColorOne', "The top color for the extension pack gradient"));
export const extensionPackGradientColorTwoColor = registerColor('extensionPackGradientColorTwo', { light: extensionPackGradientTwo, dark: extensionPackGradientTwo, hc: extensionPackGradientTwo }, nls.localize('extensionPackGradientColorTwo', "The bottom color for the extension pack gradient"));
export const gradientOne = registerColor('gradientOne', { light: '#f0f0f0', dark: gradientOneColorOne, hc: gradientOneColorOne }, nls.localize('gradientOne', "The top color for the banner image gradient"));
export const gradientTwo = registerColor('gradientTwo', { light: gradientTwoColorOne, dark: gradientTwoColorTwo, hc: gradientTwoColorTwo }, nls.localize('gradientTwo', "The bottom color for the banner image gradient"));
export const gradientBackground = registerColor('gradientBackground', { light: '#fff', dark: 'transparent', hc: 'transparent' }, nls.localize('gradientBackground', "The background color for the banner image gradient"));

// --- Notebook Colors
export const notebookToolbarIcon = registerColor('notebook.notebookToolbarIcon', { light: '#0078D4', dark: '#3AA0F3', hc: '#FFFFFF' }, nls.localize('notebook.notebookToolbarIcon', "Notebook: Main toolbar icons"));
export const notebookToolbarSelectBorder = registerColor('notebook.notebookToolbarSelectBorder', { light: '#A5A5A5', dark: '#8A8886', hc: '#2B56F2' }, nls.localize('notebook.notebookToolbarSelectBorder', "Notebook: Main toolbar select box border"));
export const notebookToolbarSelectBackground = registerColor('notebook.notebookToolbarSelectBackground', { light: '#FFFFFF', dark: '#1B1A19', hc: '#000000' }, nls.localize('notebook.notebookToolbarSelectBackground', "Notebook: Main toolbar select box background"));
export const notebookToolbarLines = registerColor('notebook.notebookToolbarLines', { light: '#D6D6D6', dark: '#323130', hc: '#2B56F2' }, nls.localize('notebook.notebookToolbarLines', "Notebook: Main toolbar bottom border and separator"));
export const dropdownArrow = registerColor('notebook.dropdownArrow', { light: '#A5A5A5', dark: '#FFFFFF', hc: '#FFFFFF' }, nls.localize('notebook.dropdownArrow', "Notebook: Main toolbar dropdown arrow"));
export const buttonMenuArrow = registerColor('notebook.buttonMenuArrow', { light: '#000000', dark: '#FFFFFF', hc: '#FFFFFF' }, nls.localize('notebook.buttonMenuArrow', "Notebook: Main toolbar custom buttonMenu dropdown arrow"));

export const toolbarBackground = registerColor('notebook.toolbarBackground', { light: '#F5F5F5', dark: '#252423', hc: '#000000' }, nls.localize('notebook.toolbarBackground', "Notebook: Markdown toolbar background"));
export const toolbarIcon = registerColor('notebook.toolbarIcon', { light: '#323130', dark: '#FFFFFF', hc: '#FFFFFF' }, nls.localize('notebook.toolbarIcon', "Notebook: Markdown toolbar icons"));
export const toolbarBottomBorder = registerColor('notebook.toolbarBottomBorder', { light: '#D4D4D4', dark: '#323130', hc: '#E86E58' }, nls.localize('notebook.toolbarBottomBorder', "Notebook: Markdown toolbar bottom border"));
// Notebook: All cells
export const cellBorder = registerColor('notebook.cellBorder', { light: '#0078D4', dark: '#3AA0F3', hc: '#E86E58' }, nls.localize('notebook.cellBorder', "Notebook: Active cell border"));
// Notebook: Markdown cell
export const markdownEditorBackground = registerColor('notebook.markdownEditorBackground', { light: '#FFFFFF', dark: '#1B1A19', hc: '#000000' }, nls.localize('notebook.markdownEditorBackground', "Notebook: Markdown editor background"));
export const splitBorder = registerColor('notebook.splitBorder', { light: '#E6E6E6', dark: '#323130', hc: '#872412' }, nls.localize('notebook.splitBorder', "Notebook: Border between Markdown editor and preview"));

// Notebook: Code cell
export const codeEditorBackground = registerColor('notebook.codeEditorBackground', { light: '#F5F5F5', dark: '#333333', hc: '#000000' }, nls.localize('notebook.codeEditorBackground', "Notebook: Code editor background"));
export const codeEditorBackgroundActive = registerColor('notebook.codeEditorBackgroundActive', { light: '#FFFFFF', dark: null, hc: null }, nls.localize('notebook.codeEditorBackgroundActive', "Notebook: Code editor background of active cell"));
export const codeEditorLineNumber = registerColor('notebook.codeEditorLineNumber', { light: '#A19F9D', dark: '#A19F9D', hc: '#FFFFFF' }, nls.localize('notebook.codeEditorLineNumber', "Notebook: Code editor line numbers"));
export const codeEditorToolbarIcon = registerColor('notebook.codeEditorToolbarIcon', { light: '#999999', dark: '#A19F9D', hc: '#FFFFFF' }, nls.localize('notebook.codeEditorToolbarIcon', "Notebook: Code editor toolbar icons"));
export const codeEditorToolbarBackground = registerColor('notebook.codeEditorToolbarBackground', { light: '#EEEEEE', dark: '#333333', hc: '#000000' }, nls.localize('notebook.codeEditorToolbarBackground', "Notebook: Code editor toolbar background"));
export const codeEditorToolbarBorder = registerColor('notebook.codeEditorToolbarBorder', { light: '#C8C6C4', dark: '#333333', hc: '#000000' }, nls.localize('notebook.codeEditorToolbarBorder', "Notebook: Code editor toolbar right border"));

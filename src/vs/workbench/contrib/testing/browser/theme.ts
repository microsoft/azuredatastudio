/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color, RGBA } from 'vs/base/common/color';
import { localize } from 'vs/nls';
import { contrastBorder, editorErrorForeground, editorForeground, registerColor, transparent } from 'vs/platform/theme/common/colorRegistry';
import { TestMessageType, TestResultState } from 'vs/workbench/contrib/testing/common/testTypes';

export const testingColorIconFailed = registerColor('testing.iconFailed', {
	dark: '#f14c4c',
	light: '#f14c4c',
	hcDark: '#f14c4c',
	hcLight: '#B5200D'
}, localize('testing.iconFailed', "Color for the 'failed' icon in the test explorer."));

export const testingColorIconErrored = registerColor('testing.iconErrored', {
	dark: '#f14c4c',
	light: '#f14c4c',
	hcDark: '#f14c4c',
	hcLight: '#B5200D'
}, localize('testing.iconErrored', "Color for the 'Errored' icon in the test explorer."));

export const testingColorIconPassed = registerColor('testing.iconPassed', {
	dark: '#73c991',
	light: '#73c991',
	hcDark: '#73c991',
	hcLight: '#007100'
}, localize('testing.iconPassed', "Color for the 'passed' icon in the test explorer."));

export const testingColorRunAction = registerColor('testing.runAction', {
	dark: testingColorIconPassed,
	light: testingColorIconPassed,
	hcDark: testingColorIconPassed,
	hcLight: testingColorIconPassed
}, localize('testing.runAction', "Color for 'run' icons in the editor."));

export const testingColorIconQueued = registerColor('testing.iconQueued', {
	dark: '#cca700',
	light: '#cca700',
	hcDark: '#cca700',
	hcLight: '#cca700'
}, localize('testing.iconQueued', "Color for the 'Queued' icon in the test explorer."));

export const testingColorIconUnset = registerColor('testing.iconUnset', {
	dark: '#848484',
	light: '#848484',
	hcDark: '#848484',
	hcLight: '#848484'
}, localize('testing.iconUnset', "Color for the 'Unset' icon in the test explorer."));

export const testingColorIconSkipped = registerColor('testing.iconSkipped', {
	dark: '#848484',
	light: '#848484',
	hcDark: '#848484',
	hcLight: '#848484'
}, localize('testing.iconSkipped', "Color for the 'Skipped' icon in the test explorer."));

export const testingPeekBorder = registerColor('testing.peekBorder', {
	dark: editorErrorForeground,
	light: editorErrorForeground,
	hcDark: contrastBorder,
	hcLight: contrastBorder
}, localize('testing.peekBorder', 'Color of the peek view borders and arrow.'));

export const testingPeekHeaderBackground = registerColor('testing.peekHeaderBackground', {
	dark: transparent(editorErrorForeground, 0.1),
	light: transparent(editorErrorForeground, 0.1),
	hcDark: null,
	hcLight: null
}, localize('testing.peekBorder', 'Color of the peek view borders and arrow.'));

export const testMessageSeverityColors: {
	[K in TestMessageType]: {
		decorationForeground: string;
		marginBackground: string;
	};
} = {
	[TestMessageType.Error]: {
		decorationForeground: registerColor(
			'testing.message.error.decorationForeground',
			{ dark: editorErrorForeground, light: editorErrorForeground, hcDark: editorForeground, hcLight: editorForeground },
			localize('testing.message.error.decorationForeground', 'Text color of test error messages shown inline in the editor.')
		),
		marginBackground: registerColor(
			'testing.message.error.lineBackground',
			{ dark: new Color(new RGBA(255, 0, 0, 0.2)), light: new Color(new RGBA(255, 0, 0, 0.2)), hcDark: null, hcLight: null },
			localize('testing.message.error.marginBackground', 'Margin color beside error messages shown inline in the editor.')
		),
	},
	[TestMessageType.Output]: {
		decorationForeground: registerColor(
			'testing.message.info.decorationForeground',
			{ dark: transparent(editorForeground, 0.5), light: transparent(editorForeground, 0.5), hcDark: transparent(editorForeground, 0.5), hcLight: transparent(editorForeground, 0.5) },
			localize('testing.message.info.decorationForeground', 'Text color of test info messages shown inline in the editor.')
		),
		marginBackground: registerColor(
			'testing.message.info.lineBackground',
			{ dark: null, light: null, hcDark: null, hcLight: null },
			localize('testing.message.info.marginBackground', 'Margin color beside info messages shown inline in the editor.')
		),
	},
};

export const testStatesToIconColors: { [K in TestResultState]?: string } = {
	[TestResultState.Errored]: testingColorIconErrored,
	[TestResultState.Failed]: testingColorIconFailed,
	[TestResultState.Passed]: testingColorIconPassed,
	[TestResultState.Queued]: testingColorIconQueued,
	[TestResultState.Unset]: testingColorIconUnset,
	[TestResultState.Skipped]: testingColorIconSkipped,
};

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./notebook';

import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { SIDE_BAR_BACKGROUND, EDITOR_GROUP_HEADER_TABS_BACKGROUND } from 'vs/workbench/common/theme';
import { activeContrastBorder, contrastBorder, buttonBackground, textLinkForeground, textLinkActiveForeground, textPreformatForeground, textBlockQuoteBackground, textBlockQuoteBorder, buttonForeground } from 'vs/platform/theme/common/colorRegistry';
import { editorLineHighlight, editorLineHighlightBorder } from 'vs/editor/common/view/editorColorRegistry';
import { cellBorder, notebookToolbarIcon, notebookToolbarLines, buttonMenuArrow, dropdownArrow, markdownEditorBackground, codeEditorBackground, codeEditorBackgroundActive, codeEditorLineNumber, codeEditorToolbarIcon, codeEditorToolbarBackground, codeEditorToolbarBorder, toolbarBackground, toolbarIcon, toolbarBottomBorder, notebookToolbarSelectBackground, splitBorder } from 'sql/platform/theme/common/colorRegistry';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { BareResultsGridInfo, getBareResultsGridInfoStyles } from 'sql/workbench/contrib/query/browser/queryResultsEditor';
import { getZoomLevel } from 'vs/base/browser/browser';
import * as types from 'vs/base/common/types';

export function registerNotebookThemes(overrideEditorThemeSetting: boolean, configurationService: IConfigurationService): IDisposable {
	return registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {

		// Book Navigation Buttons
		const buttonForegroundColor = theme.getColor(buttonForeground);
		const buttonBackgroundColor = theme.getColor(buttonBackground);

		if (buttonForegroundColor && buttonBackgroundColor) {
			collector.addRule(`
				.notebookEditor .book-nav .dialog-message-button .monaco-text-button {
					border-color: ${buttonBackgroundColor} !important;
					background-color: ${buttonForegroundColor} !important;
					color: ${buttonBackgroundColor} !important;
					border-width: 1px;
					border-style: solid;
				}
			`);
		}

		const inactiveBorder = theme.getColor(SIDE_BAR_BACKGROUND);
		const notebookLineHighlight = theme.getColor(EDITOR_GROUP_HEADER_TABS_BACKGROUND);
		// Code editor style overrides - only applied if user chooses this as preferred option
		if (overrideEditorThemeSetting) {

			let lineHighlight = theme.getColor(editorLineHighlight);
			if (!lineHighlight || lineHighlight.isTransparent()) {
				// Use notebook color override
				lineHighlight = notebookLineHighlight;
				if (lineHighlight) {
					collector.addRule(`code-component .monaco-editor .view-overlays .current-line { background-color: ${lineHighlight}; border: 0px; }`);
				}
			} // else do nothing as current theme's line highlight will work

			if (theme.defines(editorLineHighlightBorder) && theme.type !== 'hc') {
				// We need to clear out the border because we do not want to show it for notebooks
				// Override values only for the children of code-component so regular editors aren't affected
				collector.addRule(`code-component .monaco-editor .view-overlays .current-line { border: 0px; }`);
			}
		}

		// Inactive border
		if (inactiveBorder) {
			// Ensure there's always a line between editor and output
			collector.addRule(`
				.notebookEditor .notebook-cell.active code-component {
					border-color: ${inactiveBorder};
				}
			`);
		}

		// Styling with Outline color (e.g. high contrast theme)
		const outline = theme.getColor(activeContrastBorder);
		const hcOutline = theme.getColor(contrastBorder);
		if (outline) {
			collector.addRule(`
				.hc-black .notebookEditor .notebook-cell:not(.active) code-component {
					border-color: ${hcOutline};
					border-width: 0px 0px 1px 0px;
				}
				.hc-black .notebookEditor .notebook-cell:not(.active) {
					outline-color: ${hcOutline};
					outline-width: 1px;
					outline-style: solid;
				}
			`);
		}

		// Styling for tables in notebooks
		const borderColor = theme.getColor(SIDE_BAR_BACKGROUND);
		if (borderColor) {
			collector.addRule(`
			.notebookEditor text-cell-component tbody tr:nth-child(odd) {
				background: ${borderColor};
			}
			`);
		}

		// Styling for markdown cells & links in notebooks.
		// This matches the values used by default in all web views
		const linkForeground = theme.getColor(textLinkForeground);
		if (linkForeground) {
			collector.addRule(`
			.notebookEditor a:link {
				color: ${linkForeground};
			}
			`);
		}
		let activeForeground = theme.getColor(textLinkActiveForeground);
		if (activeForeground) {
			collector.addRule(`
			.notebookEditor a:hover {
				color: ${activeForeground};
			}
			`);
		}
		let preformatForeground = theme.getColor(textPreformatForeground);
		if (preformatForeground) {
			collector.addRule(`
			.notebook-preview code {
				color: ${preformatForeground};
			}
			`);
		}
		let blockQuoteBackground = theme.getColor(textBlockQuoteBackground);
		let blockQuoteBorder = theme.getColor(textBlockQuoteBorder);
		if (preformatForeground) {
			collector.addRule(`
			.notebookEditor blockquote {
				background: ${blockQuoteBackground};
				border-color: ${blockQuoteBorder};
			}
			`);
		}

		// Results grid options. Putting these here since query editor only adds them on query editor load.
		// We may want to remove from query editor as it can just live here and be loaded once, instead of once
		// per editor group which is inefficient
		let rawOptions = BareResultsGridInfo.createFromRawSettings(configurationService.getValue('resultsGrid'), getZoomLevel());

		let cssRuleText = '';
		if (types.isNumber(rawOptions.cellPadding)) {
			cssRuleText = rawOptions.cellPadding + 'px';
		} else {
			cssRuleText = rawOptions.cellPadding.join('px ') + 'px;';
		}
		collector.addRule(`.grid-panel .monaco-table .slick-cell {
			padding: ${cssRuleText}
		}
		.grid-panel .monaco-table, .message-tree {
			${getBareResultsGridInfoStyles(rawOptions)}
		}`);

		//Notebook toolbar masked icons
		const notebookToolbarIconColor = theme.getColor(notebookToolbarIcon);
		if (notebookToolbarIconColor) {
			collector.addRule(`.notebookEditor .notebook-button.masked-icon:before { background-color: ${notebookToolbarIconColor};}`);
			collector.addRule(`.notebookEditor .notebook-button.masked-pseudo:before { background-color: ${notebookToolbarIconColor};}`);
		}
		const notebookToolbarLinesColor = theme.getColor(notebookToolbarLines);
		if (notebookToolbarLinesColor) {
			collector.addRule(`.notebookEditor .editor-toolbar.actionbar-container { border-bottom-color: ${notebookToolbarLinesColor}!important;}`);
			collector.addRule(`.notebookEditor .taskbarSeparator { background-color: ${notebookToolbarLinesColor};}`);
		}
		const dropdownArrowColor = theme.getColor(dropdownArrow);
		if (dropdownArrowColor) {
			collector.addRule(`.monaco-workbench .notebookEditor .select-container:after { color: ${dropdownArrowColor};}`);
		}
		const buttonMenuArrowColor = theme.getColor(buttonMenuArrow);
		if (buttonMenuArrowColor) {
			collector.addRule(`.notebookEditor .notebook-button.masked-pseudo-after:after { background-color: ${buttonMenuArrowColor};}`);
		}

		// Active cell border, cell toolbar border, cell toolbar icons
		const cellBorderColor = theme.getColor(cellBorder);
		if (cellBorderColor) {
			collector.addRule(`.notebookEditor .notebook-cell.active { border-color: ${cellBorderColor};}`);
			collector.addRule(`.notebookEditor .notebook-cell.active cell-toolbar-component { border-color: ${cellBorderColor};}`);
			collector.addRule(`.notebookEditor .notebook-cell.active cell-toolbar-component .codicon:before { background-color: ${cellBorderColor};}`);
		}
		// Cell toolbar background
		const notebookToolbarSelectBackgroundColor = theme.getColor(notebookToolbarSelectBackground);
		if (notebookToolbarSelectBackgroundColor) {
			collector.addRule(`.notebookEditor .notebook-cell.active cell-toolbar-component { background-color: ${notebookToolbarSelectBackgroundColor};}`);
		}

		// Markdown editor toolbar
		const toolbarBackgroundColor = theme.getColor(toolbarBackground);
		if (toolbarBackgroundColor) {
			collector.addRule(`markdown-toolbar-component { background: ${toolbarBackgroundColor};}`);
		}
		const toolbarIconColor = theme.getColor(toolbarIcon);
		if (toolbarIconColor) {
			collector.addRule(`.markdown-toolbar li a:before { background-color: ${toolbarIconColor};}`);
		}
		const toolbarBottomBorderColor = theme.getColor(toolbarBottomBorder);
		if (toolbarBottomBorderColor) {
			collector.addRule(`.markdown-toolbar { border-bottom-color: ${toolbarBottomBorderColor};}`);
		}

		// Markdwon editor colors
		const markdownEditorBackgroundColor = theme.getColor(markdownEditorBackground);
		if (markdownEditorBackgroundColor) {
			collector.addRule(`text-cell-component code-component { background-color: ${markdownEditorBackgroundColor}; }`);
		}
		const splitBorderColor = theme.getColor(splitBorder);
		if (splitBorderColor) {
			collector.addRule(`.notebookEditor .notebook-cell.active text-cell-component .notebook-preview { border-left-color: ${splitBorderColor}; }`);
		}

		// Code editor colors
		const codeEditorBackgroundColor = theme.getColor(codeEditorBackground);
		if (codeEditorBackgroundColor) {
			collector.addRule(`code-cell-component code-component { background-color: ${codeEditorBackgroundColor}; }`);
		}
		const codeEditorBackgroundActiveColor = theme.getColor(codeEditorBackgroundActive);
		if (codeEditorBackgroundActiveColor) {
			collector.addRule(`.notebook-cell.active code-cell-component code-component { background-color: ${codeEditorBackgroundActiveColor}; }`);
		}
		const codeEditorLineNumberColor = theme.getColor(codeEditorLineNumber);
		if (codeEditorLineNumberColor) {
			collector.addRule(`code-cell-component code-component .editor .line-numbers { color: ${codeEditorLineNumberColor};}`);
		}
		const codeEditorToolbarIconColor = theme.getColor(codeEditorToolbarIcon);
		if (codeEditorToolbarIconColor) {
			collector.addRule(
				`code-cell-component code-component .carbon-taskbar .codicon.hideIcon { color: ${codeEditorToolbarIconColor};}`
			);
		}
		const codeEditorToolbarBackgroundColor = theme.getColor(codeEditorToolbarBackground);
		if (codeEditorToolbarBackgroundColor) {
			collector.addRule(`.notebook-cell.active code-cell-component code-component .toolbar { background-color: ${codeEditorToolbarBackgroundColor};}`);
		}
		const codeEditorToolbarBorderColor = theme.getColor(codeEditorToolbarBorder);
		if (codeEditorToolbarBorderColor) {
			collector.addRule(`.notebook-cell.active code-cell-component code-component .toolbar { border-right-color: ${codeEditorToolbarBorderColor}!important;}`);
		}
	});
}

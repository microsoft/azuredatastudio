/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./notebook';

import { registerThemingParticipant, ITheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { SIDE_BAR_BACKGROUND, SIDE_BAR_SECTION_HEADER_BACKGROUND, EDITOR_GROUP_HEADER_TABS_BACKGROUND } from 'vs/workbench/common/theme';
import { activeContrastBorder, contrastBorder, buttonBackground, textLinkForeground, textLinkActiveForeground, textPreformatForeground, textBlockQuoteBackground, textBlockQuoteBorder, buttonForeground, editorBackground, lighten } from 'vs/platform/theme/common/colorRegistry';
import { editorLineHighlight, editorLineHighlightBorder } from 'vs/editor/common/view/editorColorRegistry';
import { IDisposable } from 'vs/base/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { BareResultsGridInfo, getBareResultsGridInfoStyles } from 'sql/workbench/parts/query/browser/queryResultsEditor';
import { getZoomLevel } from 'vs/base/browser/browser';
import * as types from 'vs/base/common/types';

export function registerNotebookThemes(overrideEditorThemeSetting: boolean, configurationService: IConfigurationService): IDisposable {
	return registerThemingParticipant((theme: ITheme, collector: ICssStyleCollector) => {

		let lightBoxShadow = '0px 4px 6px 0px rgba(0, 0, 0, 0.14)';
		let darkBoxShadow = '0px 4px 6px 0px rgba(0, 0, 0, 1)';
		let addBorderToInactiveCodeCells = true;

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

		if (buttonBackgroundColor) {
			let lighterBackgroundColor = lighten(buttonBackgroundColor, 0.825)(theme);
			collector.addRule(`
				.notebookEditor .notebook-cell.active {
					border-color: ${buttonBackgroundColor};
					border-width: 1px;
				}
				.notebookEditor .notebook-cell.active:hover {
					border-color: ${buttonBackgroundColor};
				}

				.notebookEditor .hoverButton {
					border-color: ${buttonBackgroundColor};
				}
				.notebookEditor .hoverButton:active,
				.notebookEditor .hoverButton:hover {
					background-color: ${buttonBackgroundColor};
				}
				.notebookEditor .hoverButton {
					color: ${buttonBackgroundColor};
				}

				.vs-dark .notebookEditor .hoverButton {
					border-color: ${lighterBackgroundColor};
				}
				.vs-dark .notebookEditor .hoverButton:active,
				.vs-dark .notebookEditor .hoverButton:hover {
					background-color: ${lighterBackgroundColor};
				}
				.vs-dark .notebookEditor .hoverButton {
					color: ${lighterBackgroundColor};
				}
			`);
		}

		const backgroundColor = theme.getColor(editorBackground);
		if (backgroundColor) {
			collector.addRule(`
				.notebookEditor .hoverButton {
					background-color: ${backgroundColor};
				}
				.notebookEditor .hoverButton:active,
				.notebookEditor .hoverButton:hover {
					color: ${backgroundColor};
				}
				.hc-black .notebookEditor .hoverButton:active,
				.hc-black .notebookEditor .hoverButton:hover {
					color: ${backgroundColor};
				}
			`);
		}

		// Box shadow handling
		collector.addRule(`
			.notebookEditor .notebook-cell.active {
				box-shadow: ${lightBoxShadow};
			}

			.vs-dark .notebookEditor .notebook-cell.active {
				box-shadow: ${darkBoxShadow};
			}

			.hc-black .notebookEditor .notebook-cell.active {
				box-shadow: 0;
			}

			.notebookEditor .notebook-cell:hover:not(.active) {
				box-shadow: ${lightBoxShadow};
			}

			.vs-dark .notebookEditor .notebook-cell:hover:not(.active) {
				box-shadow: ${darkBoxShadow};
			}

			.hc-black .notebookEditor .notebook-cell:hover:not(.active) {
				box-shadow: 0;
			}
		`);

		const inactiveBorder = theme.getColor(SIDE_BAR_BACKGROUND);
		const sidebarColor = theme.getColor(SIDE_BAR_SECTION_HEADER_BACKGROUND);
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

			// Override code editor background if color is defined
			let codeBackground = inactiveBorder; // theme.getColor(EDITOR_GROUP_HEADER_TABS_BACKGROUND);
			if (codeBackground) {
				// Main background
				collector.addRule(`.notebook-cell:not(.active) code-component { background-color: ${codeBackground}; }`);
				collector.addRule(`
					.notebook-cell:not(.active) code-component .monaco-editor,
					.notebook-cell:not(.active) code-component .monaco-editor-background,
					.notebook-cell:not(.active) code-component .monaco-editor .inputarea.ime-input
					{
						background-color: ${codeBackground};
					}`);

				// Margin background will be the same (may override some styles)
				collector.addRule(`.notebook-cell:not(.active) code-component .monaco-editor .margin { background-color: ${codeBackground}; }`);
				addBorderToInactiveCodeCells = false;
			}
		}

		// Inactive border
		if (inactiveBorder) {
			// Standard notebook cell behavior
			collector.addRule(`
				.notebookEditor .notebook-cell {
					border-color: transparent;
					border-width: 1px;
				}
				.notebookEditor .notebook-cell.active {
					border-width: 1px;
				}
				.notebookEditor .notebook-cell:hover {
					border-color: ${inactiveBorder};
					border-width: 1px;
				}

				.notebookEditor .hoverButtonsContainer .containerBackground {
					background-color: ${inactiveBorder};
				}
			`);

			// Ensure there's always a line between editor and output
			collector.addRule(`
				.notebookEditor .notebook-cell.active code-component {
					border-color: ${inactiveBorder};
					border-width: 0px 0px 1px 0px;
					border-style: solid;
					border-radius: 0;
				}
			`);

			if (addBorderToInactiveCodeCells) {
				// Sets a border for the editor component if we don't have a custom line color for editor instead
				collector.addRule(`
					.notebookEditor .notebook-cell code-component {
						border-color: ${inactiveBorder};
						border-width: 1px;
						border-style: solid;
						border-radius: 3px 3px 3px 3px;
					}
					.notebookEditor .notebook-cell:hover code-component {
						border-width: 0px 0px 1px 0px;
						border-radius: 0px;
					}
				`);
			}
		}

		// Sidebar and cell outline toolbar color set only when active
		collector.addRule(`
			.notebook-cell.active code-component .toolbar {
				background-color: ${sidebarColor};
			}
		`);
		// Styling with Outline color (e.g. high contrast theme)
		const outline = theme.getColor(activeContrastBorder);
		const hcOutline = theme.getColor(contrastBorder);
		if (outline) {
			collector.addRule(`
				.hc-black .notebookEditor .notebook-cell:not(.active) code-component {
					border-color: ${hcOutline};
					border-width: 0px 0px 1px 0px;
				}
				.hc-black .notebookEditor .notebook-cell.active code-component {
					border-color: ${outline};
					border-width: 0px 0px 1px 0px;
				}
				.hc-black .notebookEditor .notebook-cell:not(.active) {
					outline-color: ${hcOutline};
					outline-width: 1px;
					outline-style: solid;
				}
				.notebookEditor .notebook-cell.active {
					outline-color: ${outline};
					outline-width: 1px;
					outline-style: solid;
				}

				.hc-black .notebookEditor .hoverButton {
					color: ${hcOutline};
				}
				.hc-black .notebookEditor .hoverButton:not(:active) {
					border-color: ${hcOutline};
				}
				.hc-black .notebookEditor .hoverButton:active,
				.hc-black .notebookEditor .hoverButton:hover {
					background-color: ${hcOutline};
				}
			`);
		}

		// Styling for all links in notebooks
		const linkForeground = theme.getColor(textLinkForeground);
		if (linkForeground) {
			collector.addRule(`
			.notebookEditor .scrollable a {
				color: ${linkForeground};
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
	});
}

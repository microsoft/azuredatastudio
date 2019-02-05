/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./notebook';

import { registerThemingParticipant, ITheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { activeContrastBorder, contrastBorder, buttonBackground, textLinkForeground } from 'vs/platform/theme/common/colorRegistry';

registerThemingParticipant((theme: ITheme, collector: ICssStyleCollector) => {

	let lightBoxShadow = '0px 4px 6px 0px rgba(0,0,0,0.14)';
	let darkBoxShadow = '0 4px 6px 0px rgba(0, 0, 0, 1)';
	// Active border
	const activeBorder = theme.getColor(buttonBackground);
	if (activeBorder) {
		collector.addRule(`
			.notebookEditor .notebook-cell.active {
				border-color: ${activeBorder};
				border-width: 1px;
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


	// Inactive border
	const inactiveBorder = theme.getColor(SIDE_BAR_BACKGROUND);
	if (inactiveBorder) {
		collector.addRule(`
			.notebookEditor .notebook-cell code-component {
				border-color: ${inactiveBorder};
				border-width: 1px;
				border-style: solid;
				border-radius: 3px 3px 3px 3px;
			}
			.notebookEditor .notebook-cell.active code-component {
				border-width: 0px 0px 1px 0px;
				border-radius: 0px;
			}
			.notebookEditor .notebook-cell:hover code-component {
				border-width: 0px 0px 1px 0px;
				border-radius: 0px;
			}
			.notebookEditor .notebook-cell {
				border-color: ${inactiveBorder};
				border-width: 0px;
			}
			.notebookEditor .notebook-cell.active {
				border-width: 1px;
			}
			.notebookEditor .notebook-cell:hover {
				border-width: 1px;
			}
		`);
		// toolbar color set only when active
		collector.addRule(`
			code-component .toolbar {
				background-color: ${inactiveBorder};
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
		`);
	}

	// Styling for all links in notebooks
	const linkForeground = theme.getColor(textLinkForeground);
	if (linkForeground) {
		collector.addRule(`
		.notebookEditor a:link {
			text-decoration: none;
			font-weight: bold;
			color: ${linkForeground};
		}
		`);
	}
});

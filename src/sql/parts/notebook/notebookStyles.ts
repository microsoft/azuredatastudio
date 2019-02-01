/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./notebook';

import { registerThemingParticipant, ITheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { activeContrastBorder, buttonBackground, textLinkForeground } from 'vs/platform/theme/common/colorRegistry';

registerThemingParticipant((theme: ITheme, collector: ICssStyleCollector) => {

	// Active border
	const activeBorder = theme.getColor(buttonBackground);
	if (activeBorder) {
		collector.addRule(`
			.notebookEditor .notebook-cell.active {
				border-color: ${activeBorder};
				border-width: 1px;
				box-shadow: 0px 4px 6px 0px rgba(0,0,0,0.14);
			}
		`);
	}

	// Inactive border
	const inactiveBorder = theme.getColor(SIDE_BAR_BACKGROUND);
	if (inactiveBorder) {
		collector.addRule(`
			.notebookEditor .notebook-cell {
				border-color: ${inactiveBorder};
				border-width: 1px;
			}
		`);
		// toolbar
		collector.addRule(`
			code-component .toolbar {
				background-color: ${inactiveBorder};
			}
		`);
	}

	// Styling with Outline color (e.g. high contrast theme)
	const outline = theme.getColor(activeContrastBorder);
	if (outline) {
		collector.addRule(`
			.notebookEditor .notebook-cell.active {
				outline-color: ${outline};
				outline-width: 1px;
				outline-style: solid;
			}

			.notebookEditor .notebook-cell:hover:not(.active) {
				outline-style: dashed;
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

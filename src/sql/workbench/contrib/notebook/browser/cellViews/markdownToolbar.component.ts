/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./markdownToolbar';

import { Component } from '@angular/core';
import { localize } from 'vs/nls';
import { registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { toolbarBackground, toolbarForeground } from 'sql/platform/theme/common/colorRegistry';

export const MARKDOWN_TOOLBAR_SELECTOR: string = 'markdown-toolbar-component';

@Component({
	selector: MARKDOWN_TOOLBAR_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./markdownToolbar.component.html'))
})
export class MarkdownToolbarComponent {
	public buttonBold = localize('buttonBold', "Bold");
	public buttonItalic = localize('buttonItalic', "Italic");
	public buttonHighlight = localize('buttonHighlight', "Highlight");
	public buttonCode = localize('buttonCode', "Code");
	public buttonLink = localize('buttonLink', "Link");
	public buttonList = localize('buttonList', "List");
	public buttonOrderedList = localize('buttonOrderedList', "Ordered list");
	public buttonImage = localize('buttonImage', "Image");
	public buttonPreview = localize('buttonPreview', "Markdown preview toggle - off");

	constructor() {
	}
}

registerThemingParticipant((theme, collector) => {
	const toolbarBackgroundColor = theme.getColor(toolbarBackground);
	if (toolbarBackgroundColor) {
		collector.addRule(`markdown-toolbar-component { background: ${toolbarBackgroundColor};}`);
	}
	const toolbarForegroundColor = theme.getColor(toolbarForeground);
	if (toolbarForegroundColor) {
		collector.addRule(`.markdown-toolbar li a { background-color: ${toolbarForegroundColor};}`);
	}
});

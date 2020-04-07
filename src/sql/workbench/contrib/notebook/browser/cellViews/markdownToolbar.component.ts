/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./markdownToolbar';

import { Component } from '@angular/core';
import { localize } from 'vs/nls';

export const MARKDOWN_TOOLBAR_SELECTOR: string = 'markdown-toolbar-component';

@Component({
	selector: MARKDOWN_TOOLBAR_SELECTOR,
	template: decodeURI(require.toUrl('./markdownToolbar.component.html'))
})
export class MarkdownToolbarComponent {
	public buttonBold = localize('buttonBold', "Bold");
	public buttonItalic = localize('buttonItalic', "Italic");
	public buttonCode = localize('buttonCode', "Code");
	public buttonLink = localize('buttonLink', "Link");
	public buttonList = localize('buttonList', "List");
	public buttonOrderedList = localize('buttonOrderedList', "Ordered list");
	public buttonImage = localize('buttonImage', "Image");
	public buttonPreview = localize('buttonPreview', "Markdown preview toggle - off");

	constructor() {
	}
}

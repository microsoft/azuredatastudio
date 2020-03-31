/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./markdownToolbar';
import { Component } from '@angular/core';
import { localize } from 'vs/nls';

const ButtonBold = localize('buttonBold', "Bold");
const ButtonItalic = localize('buttonItalic', "Italic");
const ButtonCode = localize('buttonCode', "Code");
const ButtonHighlight = localize('buttonHighlight', "Highlight");
const ButtonLink = localize('buttonLink', "Link");
const ButtonList = localize('buttonList', "List");
const ButtonOrderedList = localize('buttonOrderedList', "Ordered list");
const ButtonImage = localize('buttonImage', "Image");
const ButtonPreview = localize('buttonPreview', "Markdown preview toggle - off");

@Component({
	selector: 'markdown-toolbar-component',
	template: `
		<ul class="markdown-toolbar">
			<li><a class="markdown-toolbar-bold" href="#"><span class="offscreen">${ButtonBold}</span></a></li>
			<li><a class="markdown-toolbar-italic" href="#"><span class="offscreen">${ButtonItalic}</span></a></li>
			<li><a class="markdown-toolbar-code" href="#"><span class="offscreen">${ButtonCode}</span></a></li>
			<li><a class="markdown-toolbar-code" href="#"><span class="offscreen">${ButtonHighlight}</span></a></li>
			<li><a class="markdown-toolbar-link" href="#"><span class="offscreen">${ButtonLink}</span></a></li>
			<li><a class="markdown-toolbar-list" href="#"><span class="offscreen">${ButtonList}</span></a></li>
			<li><a class="markdown-toolbar-ordered-list" href="#"><span class="offscreen">${ButtonOrderedList}</span></a></li>
			<li><a class="markdown-toolbar-image" href="#"><span class="offscreen">${ButtonImage}</span></a></li>
			<li><a (click)="toggleEditMode()" class="markdown-toolbar-preview-toggle-off" href="#"><span class="offscreen">${ButtonPreview}</span></a></li>
		</ul>
	`
})
export class MarkdownToolbar {

}

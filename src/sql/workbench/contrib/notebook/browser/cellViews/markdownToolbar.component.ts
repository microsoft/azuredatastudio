/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./markdownToolbar';
import { Component } from '@angular/core';
import * as nls from 'vs/nls';

const ButtonBold = nls.localize('buttonBold', "Bold");
const ButtonItalic = nls.localize('buttonItalic', "Italic");
const ButtonCode = nls.localize('buttonCode', "Code");
const ButtonLink = nls.localize('buttonLink', "Link");
const ButtonList = nls.localize('buttonList', "List");
const ButtonOrderedList = nls.localize('buttonOrderedList', "Ordered list");
const ButtonImage = nls.localize('buttonImage', "Image");
const ButtonPreview = nls.localize('buttonPreview', "Markdown preview toggle - off");

@Component({
	selector: 'toolbar-component',
	template: `
		<ul class="markdown-toolbar">
			<li><a class="markdown-toolbar-bold" href="#"><span class="offscreen">${ButtonBold}</span></a></li>
			<li><a class="markdown-toolbar-italic" href="#"><span class="offscreen">${ButtonItalic}</span></a></li>
			<li><a class="markdown-toolbar-code" href="#"><span class="offscreen">${ButtonCode}</span></a></li>
			<li><a class="markdown-toolbar-link" href="#"><span class="offscreen">${ButtonLink}</span></a></li>
			<li><a class="markdown-toolbar-list" href="#"><span class="offscreen">${ButtonList}</span></a></li>
			<li><a class="markdown-toolbar-ordered-list" href="#"><span class="offscreen">${ButtonOrderedList}</span></a></li>
			<li><a class="markdown-toolbar-image" href="#"><span class="offscreen">${ButtonImage}</span></a></li>
			<li><a (click)="toggleEditMode()" class="markdown-toolbar-preview-toggle-off" href="#"><span class="offscreen">${ButtonPreview}</span></a></li>
		</ul>
	`
})
export default class MarkdownToolbar {


}

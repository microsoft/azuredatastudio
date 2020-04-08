/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./markdownToolbar';
import { Component, Input, Inject, ViewChild, ElementRef } from '@angular/core';
import { localize } from 'vs/nls';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { TransformMarkdownAction, MarkdownButtonType } from 'sql/workbench/contrib/notebook/browser/markdownToolbarActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { toolbarBackground, toolbarForeground } from 'sql/platform/theme/common/colorRegistry';

export const MARKDOWN_TOOLBAR_SELECTOR: string = 'markdown-toolbar-component';

@Component({
	selector: MARKDOWN_TOOLBAR_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./markdownToolbar.component.html'))
})
export class MarkdownToolbarComponent {
	@ViewChild('mdtoolbar', { read: ElementRef }) private mdtoolbar: ElementRef;

	public buttonBold = localize('buttonBold', "Bold");
	public buttonItalic = localize('buttonItalic', "Italic");
	public buttonHighlight = localize('buttonHighlight', "Highlight");
	public buttonCode = localize('buttonCode', "Code");
	public buttonLink = localize('buttonLink', "Link");
	public buttonList = localize('buttonList', "List");
	public buttonOrderedList = localize('buttonOrderedList', "Ordered list");
	public buttonImage = localize('buttonImage', "Image");
	public buttonPreview = localize('buttonPreview', "Markdown preview toggle - off");

	@Input() public cellModel: ICellModel;
	private _actionBar: Taskbar;

	constructor(
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService
	) { }

	ngOnInit() {
		this.initActionBar();
	}

	private initActionBar() {
		let boldButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.boldText', '', 'markdown-toolbar-bold', this.buttonBold, this.cellModel, MarkdownButtonType.BOLD);
		let italicButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.italicText', '', 'markdown-toolbar-italic', this.buttonItalic, this.cellModel, MarkdownButtonType.ITALIC);
		let highlightButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.highlightText', '', 'markdown-toolbar-highlight', this.buttonHighlight, this.cellModel, MarkdownButtonType.HIGHLIGHT);
		let codeButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.codeText', '', 'markdown-toolbar-code', this.buttonCode, this.cellModel, MarkdownButtonType.CODE);
		let linkButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.linkText', '', 'markdown-toolbar-link', this.buttonLink, this.cellModel, MarkdownButtonType.LINK);
		let listButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.listText', '', 'markdown-toolbar-list', this.buttonList, this.cellModel, MarkdownButtonType.UNORDERED_LIST);
		let orderedListButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.orderedText', '', 'markdown-toolbar-ordered-list', this.buttonOrderedList, this.cellModel, MarkdownButtonType.ORDERED_LIST);
		let imageButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.imageText', '', 'markdown-toolbar-image', this.buttonImage, this.cellModel, MarkdownButtonType.IMAGE);

		let taskbar = <HTMLElement>this.mdtoolbar.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.context = this;
		this._actionBar.setContent([
			{ action: boldButton },
			{ action: italicButton },
			{ action: highlightButton },
			{ action: codeButton },
			{ action: linkButton },
			{ action: listButton },
			{ action: orderedListButton },
			{ action: imageButton }
		]);
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

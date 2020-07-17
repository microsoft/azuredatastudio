/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./markdownToolbar';
import * as DOM from 'vs/base/browser/dom';
import { Component, Input, Inject, ViewChild, ElementRef } from '@angular/core';
import { localize } from 'vs/nls';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { TransformMarkdownAction, MarkdownButtonType, TogglePreviewAction } from 'sql/workbench/contrib/notebook/browser/markdownToolbarActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DropdownMenuActionViewItem } from 'sql/base/browser/ui/buttonMenu/buttonMenu';

export const MARKDOWN_TOOLBAR_SELECTOR: string = 'markdown-toolbar-component';

@Component({
	selector: MARKDOWN_TOOLBAR_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./markdownToolbar.component.html'))
})
export class MarkdownToolbarComponent {
	@ViewChild('mdtoolbar', { read: ElementRef }) private mdtoolbar: ElementRef;

	public buttonBold = localize('buttonBold', "Bold");
	public buttonItalic = localize('buttonItalic', "Italic");
	public buttonUnderline = localize('buttonUnderline', "Underline");
	public buttonHighlight = localize('buttonHighlight', "Highlight");
	public buttonCode = localize('buttonCode', "Code");
	public buttonLink = localize('buttonLink', "Link");
	public buttonList = localize('buttonList', "List");
	public buttonOrderedList = localize('buttonOrderedList', "Ordered list");
	public buttonImage = localize('buttonImage', "Image");
	public buttonPreview = localize('buttonPreview', "Markdown preview toggle - off");
	public dropdownHeading = localize('dropdownHeading', "Heading");
	public optionHeading1 = localize('optionHeading1', "Heading 1");
	public optionHeading2 = localize('optionHeading2', "Heading 2");
	public optionHeading3 = localize('optionHeading3', "Heading 3");
	public optionParagraph = localize('optionParagraph', "Paragraph");

	@Input() public cellModel: ICellModel;
	private _actionBar: Taskbar;

	constructor(
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService
	) { }

	ngOnInit() {
		this.initActionBar();
	}

	private initActionBar() {
		let boldButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.boldText', '', 'bold masked-icon', this.buttonBold, this.cellModel, MarkdownButtonType.BOLD);
		let italicButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.italicText', '', 'italic masked-icon', this.buttonItalic, this.cellModel, MarkdownButtonType.ITALIC);
		let underlineButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.underlineText', '', 'underline masked-icon', this.buttonUnderline, this.cellModel, MarkdownButtonType.UNDERLINE);
		let highlightButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.highlightText', '', 'highlight masked-icon', this.buttonHighlight, this.cellModel, MarkdownButtonType.HIGHLIGHT);
		let codeButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.codeText', '', 'code masked-icon', this.buttonCode, this.cellModel, MarkdownButtonType.CODE);
		let linkButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.linkText', '', 'insert-link masked-icon', this.buttonLink, this.cellModel, MarkdownButtonType.LINK);
		let listButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.listText', '', 'list masked-icon', this.buttonList, this.cellModel, MarkdownButtonType.UNORDERED_LIST);
		let orderedListButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.orderedText', '', 'ordered-list masked-icon', this.buttonOrderedList, this.cellModel, MarkdownButtonType.ORDERED_LIST);
		let imageButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.imageText', '', 'insert-image masked-icon', this.buttonImage, this.cellModel, MarkdownButtonType.IMAGE);
		let togglePreviewAction = this._instantiationService.createInstance(TogglePreviewAction, 'notebook.togglePreview masked-icon', true, this.cellModel.showPreview);

		let headingDropdown = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading', '', 'heading', this.dropdownHeading, this.cellModel, null);
		let heading1 = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading1', this.optionHeading1, 'heading 1', this.optionHeading1, this.cellModel, MarkdownButtonType.HEADING1);
		let heading2 = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading2', this.optionHeading2, 'heading 2', this.optionHeading2, this.cellModel, MarkdownButtonType.HEADING2);
		let heading3 = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading3', this.optionHeading3, 'heading 3', this.optionHeading3, this.cellModel, MarkdownButtonType.HEADING3);
		let paragraph = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.paragraph', this.optionParagraph, 'paragraph', this.optionParagraph, this.cellModel, MarkdownButtonType.PARAGRAPH);

		let taskbar = <HTMLElement>this.mdtoolbar.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.context = this;

		let buttonDropdownContainer = DOM.$('li.action-item');
		buttonDropdownContainer.setAttribute('role', 'presentation');
		let dropdownMenuActionViewItem = new DropdownMenuActionViewItem(
			headingDropdown,
			[heading1, heading2, heading3, paragraph],
			this.contextMenuService,
			undefined,
			this._actionBar.actionRunner,
			undefined,
			'notebook-button masked-pseudo-after dropdown-arrow',
			this.optionParagraph,
			undefined
		);
		dropdownMenuActionViewItem.render(buttonDropdownContainer);
		dropdownMenuActionViewItem.setActionContext(this);

		this._actionBar.setContent([
			{ action: boldButton },
			{ action: italicButton },
			{ action: underlineButton },
			{ action: highlightButton },
			{ action: codeButton },
			{ action: linkButton },
			{ action: listButton },
			{ action: orderedListButton },
			{ action: imageButton },
			{ element: buttonDropdownContainer },
			{ action: togglePreviewAction }
		]);
	}
}

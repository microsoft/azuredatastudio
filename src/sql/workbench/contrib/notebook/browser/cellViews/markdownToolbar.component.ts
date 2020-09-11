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
import { TransformMarkdownAction, MarkdownButtonType, ToggleViewAction } from 'sql/workbench/contrib/notebook/browser/markdownToolbarActions';
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

	public textViewButton = localize('textViewButton', "View as Text");
	public splitViewButton = localize('splitViewButton', "View as Split");
	public markdownButton = localize('markdownButton', "View as Markdown");

	private boldButton;
	private italicButton;
	private underlineButton;
	private highlightButton;
	private codeButton;
	private linkButton;
	private listButton;
	private orderedListButton;
	private imageButton;
	private buttonDropdownContainer;

	@Input() public cellModel: ICellModel;
	private _actionBar: Taskbar;
	_toggleTextViewAction: ToggleViewAction;
	_toggleSplitViewAction: ToggleViewAction;
	_toggleMarkdownViewAction: ToggleViewAction;

	constructor(
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService
	) { }

	ngOnInit() {
		this.initActionBar();
	}

	private initActionBar() {
		this.boldButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.boldText', '', 'bold masked-icon', this.buttonBold, this.cellModel, MarkdownButtonType.BOLD);
		this.italicButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.italicText', '', 'italic masked-icon', this.buttonItalic, this.cellModel, MarkdownButtonType.ITALIC);
		this.underlineButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.underlineText', '', 'underline masked-icon', this.buttonUnderline, this.cellModel, MarkdownButtonType.UNDERLINE);
		this.highlightButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.highlightText', '', 'highlight masked-icon', this.buttonHighlight, this.cellModel, MarkdownButtonType.HIGHLIGHT);
		this.codeButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.codeText', '', 'code masked-icon', this.buttonCode, this.cellModel, MarkdownButtonType.CODE);
		this.linkButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.linkText', '', 'insert-link masked-icon', this.buttonLink, this.cellModel, MarkdownButtonType.LINK);
		this.listButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.listText', '', 'list masked-icon', this.buttonList, this.cellModel, MarkdownButtonType.UNORDERED_LIST);
		this.orderedListButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.orderedText', '', 'ordered-list masked-icon', this.buttonOrderedList, this.cellModel, MarkdownButtonType.ORDERED_LIST);
		this.imageButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.imageText', '', 'insert-image masked-icon', this.buttonImage, this.cellModel, MarkdownButtonType.IMAGE);

		let headingDropdown = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading', '', 'heading', this.dropdownHeading, this.cellModel, null);
		let heading1 = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading1', this.optionHeading1, 'heading 1', this.optionHeading1, this.cellModel, MarkdownButtonType.HEADING1);
		let heading2 = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading2', this.optionHeading2, 'heading 2', this.optionHeading2, this.cellModel, MarkdownButtonType.HEADING2);
		let heading3 = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading3', this.optionHeading3, 'heading 3', this.optionHeading3, this.cellModel, MarkdownButtonType.HEADING3);
		let paragraph = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.paragraph', this.optionParagraph, 'paragraph', this.optionParagraph, this.cellModel, MarkdownButtonType.PARAGRAPH);

		this._toggleTextViewAction = this._instantiationService.createInstance(ToggleViewAction, 'notebook.toggleTextView', '', 'masked-icon show-text active', this.textViewButton, true, false);
		this._toggleSplitViewAction = this._instantiationService.createInstance(ToggleViewAction, 'notebook.toggleSplitView', '', 'masked-icon split-toggle-on', this.splitViewButton, true, true);
		this._toggleMarkdownViewAction = this._instantiationService.createInstance(ToggleViewAction, 'notebook.toggleMarkdownView', '', 'masked-icon show-markdown', this.markdownButton, false, true);

		let taskbar = <HTMLElement>this.mdtoolbar.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.context = this;

		this.buttonDropdownContainer = DOM.$('li.action-item');
		this.buttonDropdownContainer.setAttribute('role', 'presentation');
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
		dropdownMenuActionViewItem.render(this.buttonDropdownContainer);
		dropdownMenuActionViewItem.setActionContext(this);

		// Hide link and image buttons in WYSIWYG mode
		if (this.cellModel.showPreview && !this.cellModel.showMarkdown) {
			this._actionBar.setContent([
				{ action: this.boldButton },
				{ action: this.italicButton },
				{ action: this.underlineButton },
				{ action: this.highlightButton },
				{ action: this.codeButton },
				{ action: this.listButton },
				{ action: this.orderedListButton },
				{ element: this.buttonDropdownContainer },
				{ action: this._toggleTextViewAction },
				{ action: this._toggleSplitViewAction },
				{ action: this._toggleMarkdownViewAction }
			]);
		} else {
			this._actionBar.setContent([
				{ action: this.boldButton },
				{ action: this.italicButton },
				{ action: this.underlineButton },
				{ action: this.highlightButton },
				{ action: this.codeButton },
				{ action: this.linkButton },
				{ action: this.listButton },
				{ action: this.orderedListButton },
				{ action: this.imageButton },
				{ element: this.buttonDropdownContainer },
				{ action: this._toggleTextViewAction },
				{ action: this._toggleSplitViewAction },
				{ action: this._toggleMarkdownViewAction }
			]);
		}
	}

	public hideLinkAndImageButtons() {
		this._actionBar.setContent([
			{ action: this.boldButton },
			{ action: this.italicButton },
			{ action: this.underlineButton },
			{ action: this.highlightButton },
			{ action: this.codeButton },
			{ action: this.listButton },
			{ action: this.orderedListButton },
			{ element: this.buttonDropdownContainer },
			{ action: this._toggleTextViewAction },
			{ action: this._toggleSplitViewAction },
			{ action: this._toggleMarkdownViewAction }
		]);
	}

	public showLinkAndImageButtons() {
		this._actionBar.setContent([
			{ action: this.boldButton },
			{ action: this.italicButton },
			{ action: this.underlineButton },
			{ action: this.highlightButton },
			{ action: this.codeButton },
			{ action: this.linkButton },
			{ action: this.listButton },
			{ action: this.orderedListButton },
			{ action: this.imageButton },
			{ element: this.buttonDropdownContainer },
			{ action: this._toggleTextViewAction },
			{ action: this._toggleSplitViewAction },
			{ action: this._toggleMarkdownViewAction }
		]);
	}

	public removeActiveClassFromModeActions() {
		const activeClass = ' active';
		for (let action of [this._toggleTextViewAction, this._toggleSplitViewAction, this._toggleMarkdownViewAction]) {
			if (action.class.includes(activeClass)) {
				action.class = action.class.replace(activeClass, '');
			}
		}
	}
}

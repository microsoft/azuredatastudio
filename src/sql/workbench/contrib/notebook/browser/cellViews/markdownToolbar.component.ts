/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./markdownToolbar';
import * as DOM from 'vs/base/browser/dom';
import { Button, IButtonStyles } from 'sql/base/browser/ui/button/button';
import { Component, Input, Inject, ViewChild, ElementRef, HostListener } from '@angular/core';
import { localize } from 'vs/nls';
import { CellEditModes, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { ITaskbarContent, Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { TransformMarkdownAction, MarkdownTextTransformer, MarkdownButtonType, ToggleViewAction, insertFormattedMarkdown } from 'sql/workbench/contrib/notebook/browser/markdownToolbarActions';
import { ICellEditorProvider, INotebookEditor, INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DropdownMenuActionViewItem } from 'sql/base/browser/ui/buttonMenu/buttonMenu';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { ILinkCalloutDialogOptions, LinkCalloutDialog } from 'sql/workbench/contrib/notebook/browser/calloutDialog/linkCalloutDialog';
import { TextModel } from 'vs/editor/common/model/textModel';
import { IEditor } from 'vs/editor/common/editorCommon';
import * as path from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';
import { escape } from 'vs/base/common/strings';
import { IImageCalloutDialogOptions, ImageCalloutDialog } from 'sql/workbench/contrib/notebook/browser/calloutDialog/imageCalloutDialog';
import { TextCellEditModes } from 'sql/workbench/services/notebook/common/contracts';
import { NotebookLinkHandler } from 'sql/workbench/contrib/notebook/browser/notebookLinkHandler';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { FileAccess } from 'vs/base/common/network';

export const MARKDOWN_TOOLBAR_SELECTOR: string = 'markdown-toolbar-component';
const linksRegex = /\[(?<text>.+)\]\((?<url>[^ ]+)(?: "(?<title>.+)")?\)/;

@Component({
	selector: MARKDOWN_TOOLBAR_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./markdownToolbar.component.html'))
})
export class MarkdownToolbarComponent extends AngularDisposable {
	@ViewChild('mdtoolbar', { read: ElementRef }) private mdtoolbar: ElementRef;

	@HostListener('document:keydown', ['$event'])
	async onkeydown(e: KeyboardEvent) {
		if (this.cellModel?.currentMode === CellEditModes.SPLIT || this.cellModel?.currentMode === CellEditModes.MARKDOWN) {
			const keyEvent = new StandardKeyboardEvent(e);
			let markdownTextTransformer = new MarkdownTextTransformer(this._notebookService, this.cellModel);
			if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.keyCode === KeyCode.KeyB) {
				// Bold Text
				DOM.EventHelper.stop(e, true);
				await markdownTextTransformer.transformText(MarkdownButtonType.BOLD);
			} else if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.keyCode === KeyCode.KeyI) {
				// Italicize text
				DOM.EventHelper.stop(e, true);
				await markdownTextTransformer.transformText(MarkdownButtonType.ITALIC);
			} else if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.keyCode === KeyCode.KeyU) {
				// Underline text
				DOM.EventHelper.stop(e, true);
				await markdownTextTransformer.transformText(MarkdownButtonType.UNDERLINE);
			} else if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.shiftKey && keyEvent.keyCode === KeyCode.KeyK) {
				// Code Block
				DOM.EventHelper.stop(e, true);
				await markdownTextTransformer.transformText(MarkdownButtonType.CODE);
			} else if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.shiftKey && keyEvent.keyCode === KeyCode.KeyH) {
				// Highlight Text
				DOM.EventHelper.stop(e, true);
				await markdownTextTransformer.transformText(MarkdownButtonType.HIGHLIGHT);
			}
		}
	}

	public bold = localize('bold', "Bold");
	public italic = localize('italic', "Italic");
	public underline = localize('underline', "Underline");
	public highlight = localize('highlight', "Highlight");
	public insertCode = localize('insertCode', "Insert code");
	public insertLink = localize('insertLink', "Insert link");
	public insertList = localize('insertList', "Insert list");
	public insertOrderedList = localize('insertOrderedList', "Insert ordered list");
	public insertImage = localize('insertImage', "Insert image");
	public buttonPreview = localize('buttonPreview', "Markdown preview toggle - off");
	public headingDropdownLabel = localize('headingDropdownLabel', "Text Size");
	public optionHeading1 = localize('optionHeading1', "Heading 1");
	public optionHeading2 = localize('optionHeading2', "Heading 2");
	public optionHeading3 = localize('optionHeading3', "Heading 3");
	public optionParagraph = localize('optionParagraph', "Paragraph");

	public richTextViewButton = localize('richTextViewButton', "Rich Text View");
	public splitViewButton = localize('splitViewButton', "Split View");
	public markdownViewButton = localize('markdownViewButton', "Markdown View");

	private _taskbarContent: Array<ITaskbarContent>;
	private _wysiwygTaskbarContent: Array<ITaskbarContent>;
	private _linkCallout: LinkCalloutDialog;

	@Input() public cellModel: ICellModel;
	@Input() public output: ElementRef;
	private _actionBar: Taskbar;
	_toggleTextViewAction: ToggleViewAction;
	_toggleSplitViewAction: ToggleViewAction;
	_toggleMarkdownViewAction: ToggleViewAction;
	private _notebookEditor: INotebookEditor;
	private _cellEditor: ICellEditorProvider;

	constructor(
		@Inject(INotebookService) private _notebookService: INotebookService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IContextMenuService) private _contextMenuService: IContextMenuService,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService
	) {
		super();
	}

	ngOnInit() {
		this.initActionBar();
	}

	private initActionBar() {
		let linkButtonContainer = DOM.$('li.action-item');
		linkButtonContainer.setAttribute('role', 'presentation');
		let linkButton = new Button(linkButtonContainer);
		linkButton.title = this.insertLink;
		linkButton.element.setAttribute('class', 'action-label codicon insert-link masked-icon');
		let buttonStyle: IButtonStyles = {
			buttonBackground: null
		};
		linkButton.style(buttonStyle);

		this._register(DOM.addDisposableListener(linkButtonContainer, DOM.EventType.CLICK, async e => {
			await this.onInsertButtonClick(e, MarkdownButtonType.LINK_PREVIEW);
		}));

		let imageButtonContainer = DOM.$('li.action-item');
		imageButtonContainer.setAttribute('role', 'presentation');
		let imageButton = new Button(imageButtonContainer);
		imageButton.title = this.insertImage;
		imageButton.element.setAttribute('class', 'action-label codicon insert-image masked-icon');

		imageButton.style(buttonStyle);

		this._register(DOM.addDisposableListener(imageButtonContainer, DOM.EventType.CLICK, async e => {
			await this.onInsertButtonClick(e, MarkdownButtonType.IMAGE_PREVIEW);
		}));

		let boldButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.boldText', '', 'bold masked-icon', this.bold, this.cellModel, MarkdownButtonType.BOLD);
		let italicButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.italicText', '', 'italic masked-icon', this.italic, this.cellModel, MarkdownButtonType.ITALIC);
		let underlineButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.underlineText', '', 'underline masked-icon', this.underline, this.cellModel, MarkdownButtonType.UNDERLINE);
		let highlightButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.highlightText', '', 'highlight masked-icon', this.highlight, this.cellModel, MarkdownButtonType.HIGHLIGHT);
		let codeButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.codeText', '', 'code masked-icon', this.insertCode, this.cellModel, MarkdownButtonType.CODE);
		let listButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.listText', '', 'list masked-icon', this.insertList, this.cellModel, MarkdownButtonType.UNORDERED_LIST);
		let orderedListButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.orderedText', '', 'ordered-list masked-icon', this.insertOrderedList, this.cellModel, MarkdownButtonType.ORDERED_LIST);
		let headingDropdown = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading', '', 'heading', this.headingDropdownLabel, this.cellModel, null);
		let heading1 = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading1', this.optionHeading1, 'heading 1', this.optionHeading1, this.cellModel, MarkdownButtonType.HEADING1);
		let heading2 = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading2', this.optionHeading2, 'heading 2', this.optionHeading2, this.cellModel, MarkdownButtonType.HEADING2);
		let heading3 = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading3', this.optionHeading3, 'heading 3', this.optionHeading3, this.cellModel, MarkdownButtonType.HEADING3);
		let paragraph = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.paragraph', this.optionParagraph, 'paragraph', this.optionParagraph, this.cellModel, MarkdownButtonType.PARAGRAPH);

		this._toggleTextViewAction = this._instantiationService.createInstance(ToggleViewAction, 'notebook.toggleTextView', '', this.cellModel.defaultTextEditMode === TextCellEditModes.RichText ? 'masked-icon show-text active' : 'masked-icon show-text', this.richTextViewButton, true, false);
		this._toggleSplitViewAction = this._instantiationService.createInstance(ToggleViewAction, 'notebook.toggleSplitView', '', this.cellModel.defaultTextEditMode === TextCellEditModes.SplitView ? 'masked-icon split-toggle-on active' : 'masked-icon split-toggle-on', this.splitViewButton, true, true);
		this._toggleMarkdownViewAction = this._instantiationService.createInstance(ToggleViewAction, 'notebook.toggleMarkdownView', '', this.cellModel.defaultTextEditMode === TextCellEditModes.Markdown ? 'masked-icon show-markdown active' : 'masked-icon show-markdown', this.markdownViewButton, false, true);

		let taskbar = <HTMLElement>this.mdtoolbar.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.context = this;

		let buttonDropdownContainer = DOM.$('li.action-item');
		buttonDropdownContainer.setAttribute('role', 'presentation');
		let dropdownMenuActionViewItem = new DropdownMenuActionViewItem(
			headingDropdown,
			[heading1, heading2, heading3, paragraph],
			this._contextMenuService,
			undefined,
			this._actionBar.actionRunner,
			undefined,
			'masked-pseudo-after dropdown-arrow heading-dropdown',
			this.headingDropdownLabel,
			undefined
		);
		dropdownMenuActionViewItem.render(buttonDropdownContainer);
		dropdownMenuActionViewItem.setActionContext(this);

		this._taskbarContent = [
			{ action: boldButton },
			{ action: italicButton },
			{ action: underlineButton },
			{ action: highlightButton },
			{ action: codeButton },
			{ element: linkButtonContainer },
			{ action: listButton },
			{ action: orderedListButton },
			{ element: imageButtonContainer },
			{ element: buttonDropdownContainer },
			{ action: this._toggleTextViewAction },
			{ action: this._toggleSplitViewAction },
			{ action: this._toggleMarkdownViewAction }
		];
		this._wysiwygTaskbarContent = [
			{ action: boldButton },
			{ action: italicButton },
			{ action: underlineButton },
			{ action: highlightButton },
			{ action: codeButton },
			{ element: linkButtonContainer },
			{ action: listButton },
			{ action: orderedListButton },
			{ element: buttonDropdownContainer },
			{ action: this._toggleTextViewAction },
			{ action: this._toggleSplitViewAction },
			{ action: this._toggleMarkdownViewAction }
		];

		// Hide link and image buttons in WYSIWYG mode
		if (this.cellModel.showPreview && !this.cellModel.showMarkdown) {
			this._actionBar.setContent(this._wysiwygTaskbarContent);
		} else {
			this._actionBar.setContent(this._taskbarContent);
		}
		this._notebookEditor = this._notebookService.findNotebookEditor(this.cellModel?.notebookModel?.notebookUri);
		this.updateActiveViewAction();
	}

	public async onInsertButtonClick(event: MouseEvent, type: MarkdownButtonType): Promise<void> {
		DOM.EventHelper.stop(event, true);
		let triggerElement = event.target as HTMLElement;
		let needsTransform = true;
		let linkCalloutResult: ILinkCalloutDialogOptions;
		let imageCalloutResult: IImageCalloutDialogOptions;

		if (type === MarkdownButtonType.LINK_PREVIEW) {
			linkCalloutResult = await this.createCallout(type, triggerElement);
			// If no URL is present, no-op
			if (!linkCalloutResult.insertUnescapedLinkUrl) {
				return;
			}
			// If cell edit mode isn't WYSIWYG, use result from callout. No need for further transformation.
			if (this.cellModel.currentMode !== CellEditModes.WYSIWYG) {
				needsTransform = false;
			} else {
				let notebookLink = new NotebookLinkHandler(this.cellModel?.notebookModel?.notebookUri, linkCalloutResult.insertUnescapedLinkUrl, this._configurationService);
				let linkUrl = notebookLink.getLinkUrl();
				// Otherwise, re-focus on the output element, and insert the link directly.
				this.output?.nativeElement?.focus();
				// Need to encode URI here in order for user to click the proper encoded link in WYSIWYG
				let encodedLinkURL = notebookLink.getEncodedLinkUrl();
				document.execCommand('insertHTML', false, `<a href="${encodedLinkURL}" title="${linkUrl}" is-encoded="true" is-absolute=${notebookLink.isAbsolutePath}>${escape(linkCalloutResult?.insertUnescapedLinkLabel)}</a>`);
				return;
			}
		} else if (type === MarkdownButtonType.IMAGE_PREVIEW) {
			imageCalloutResult = await this.createCallout(type, triggerElement);
			// If cell edit mode isn't WYSIWYG, use result from callout. No need for further transformation.
			if (this.cellModel.currentMode !== CellEditModes.WYSIWYG) {
				needsTransform = false;
			}
		}

		const transformer = new MarkdownTextTransformer(this._notebookService, this.cellModel);
		if (needsTransform) {
			await transformer.transformText(type);
		} else if (!needsTransform) {
			if (type === MarkdownButtonType.LINK_PREVIEW) {
				await insertFormattedMarkdown(linkCalloutResult?.insertEscapedMarkdown, this.getCellEditorControl());
			} else if (type === MarkdownButtonType.IMAGE_PREVIEW) {
				if (imageCalloutResult.embedImage) {
					// VS Code blocks loading directly from the file protocol - we have to transform it to a vscode-file URI
					// first. Currently we assume that the path here is always going to be a path since we don't support
					// embedding images from web links.
					const uri = FileAccess.asBrowserUri(URI.file(imageCalloutResult.imagePath));
					let base64String = await this.getFileContentBase64(uri);
					let mimeType = await this.getFileMimeType(uri);
					const originalImageName: string = path.basename(imageCalloutResult.imagePath).replace(/\s/g, '');
					let attachmentName = this.cellModel.addAttachment(mimeType, base64String, originalImageName);
					if (originalImageName !== attachmentName) {
						imageCalloutResult.insertEscapedMarkdown = `![${attachmentName}](attachment:${attachmentName.replace(/\s/g, '')})`;
					}
					await insertFormattedMarkdown(imageCalloutResult.insertEscapedMarkdown, this.getCellEditorControl());
				}
				await insertFormattedMarkdown(imageCalloutResult.insertEscapedMarkdown, this.getCellEditorControl());
			}
		}
	}

	public hideImageButton() {
		this._actionBar.setContent(this._wysiwygTaskbarContent);
	}

	public showLinkAndImageButtons() {
		this._actionBar.setContent(this._taskbarContent);
	}

	private removeActiveClassFromModeActions() {
		const activeClass = ' active';
		for (let action of [this._toggleTextViewAction, this._toggleSplitViewAction, this._toggleMarkdownViewAction]) {
			if (action.class.includes(activeClass)) {
				action.class = action.class.replace(activeClass, '');
			}
		}
	}

	public updateActiveViewAction() {
		this.removeActiveClassFromModeActions();
		const activeClass = ' active';
		switch (this.cellModel.currentMode) {
			case CellEditModes.MARKDOWN: this._toggleMarkdownViewAction.class += activeClass; break;
			case CellEditModes.SPLIT: this._toggleSplitViewAction.class += activeClass; break;
			case CellEditModes.WYSIWYG: this._toggleTextViewAction.class += activeClass; break;
		}
	}

	/**
	 * Instantiate modal for use as callout when inserting Link or Image into markdown.
	 * Returns markup created after user enters values and submits the callout.
	 */
	private async createCallout(type: MarkdownButtonType, triggerElement: HTMLElement): Promise<ILinkCalloutDialogOptions> {
		const triggerPosX = triggerElement.getBoundingClientRect().left;
		const triggerPosY = triggerElement.getBoundingClientRect().top;
		const triggerHeight = triggerElement.offsetHeight;
		const triggerWidth = triggerElement.offsetWidth;
		const dialogProperties = { xPos: triggerPosX, yPos: triggerPosY, width: triggerWidth, height: triggerHeight };
		const dialogPosition = window.innerHeight - triggerPosY < 250 ? 'above' : 'below';
		let calloutOptions;

		if (type === MarkdownButtonType.LINK_PREVIEW) {
			const defaultLabel = this.getCurrentLinkLabel();
			const defaultLinkUrl = this.getCurrentLinkUrl();
			this._linkCallout = this._instantiationService.createInstance(LinkCalloutDialog, this.insertLink, dialogPosition, dialogProperties, defaultLabel, defaultLinkUrl);
			this._linkCallout.render();
			calloutOptions = await this._linkCallout.open();
		} else if (type === MarkdownButtonType.IMAGE_PREVIEW) {
			const imageCallout = this._instantiationService.createInstance(ImageCalloutDialog, this.insertImage, dialogPosition, dialogProperties);
			imageCallout.render();
			calloutOptions = await imageCallout.open();
		}
		return calloutOptions;
	}

	private getCurrentLinkLabel(): string {
		if (this.cellModel.currentMode === CellEditModes.WYSIWYG) {
			return document.getSelection()?.toString() || '';
		} else {
			const editorControl = this.getCellEditorControl();
			const selection = editorControl?.getSelection();
			if (selection && !selection.isEmpty()) {
				const textModel = editorControl?.getModel() as TextModel;
				const value = textModel?.getValueInRange(selection);
				let linkMatches = value?.match(linksRegex);
				return linkMatches?.groups.text || value || '';
			}
			return '';
		}
	}

	private getCurrentLinkUrl(): string {
		if (this.cellModel.currentMode === CellEditModes.WYSIWYG) {
			const anchorNode = document.getSelection().anchorNode;
			if (!anchorNode) {
				return '';
			}
			const parentNode = anchorNode.parentNode as HTMLAnchorElement;
			const linkHandler = new NotebookLinkHandler(this.cellModel?.notebookModel?.notebookUri, parentNode, this._configurationService);
			return linkHandler.getLinkUrl();
		} else {
			const editorControl = this.getCellEditorControl();
			const selection = editorControl?.getSelection();
			if (selection && !selection.isEmpty()) {
				const textModel = editorControl?.getModel() as TextModel;
				const value = textModel?.getValueInRange(selection);
				let linkMatches = value?.match(linksRegex);
				return linkMatches?.groups.url || '';
			}
			return '';
		}
	}

	private getCellEditorControl(): IEditor | undefined {
		// If control doesn't exist, editor may have been destroyed previously when switching edit modes
		if (!this._cellEditor?.getEditor()?.getControl()) {
			this._cellEditor = this._notebookEditor?.cellEditors?.find(e => e.cellGuid() === this.cellModel?.cellGuid);
		}
		if (this._cellEditor?.hasEditor) {
			return this._cellEditor.getEditor()?.getControl();
		}
		return undefined;
	}

	public async getFileContentBase64(fileUri: URI): Promise<string> {
		return new Promise<string>(async resolve => {
			let response = await fetch(fileUri.toString());
			let blob = await response.blob();

			let file = new File([blob], fileUri.toString());
			let reader = new FileReader();
			// Read file content on file loaded event
			reader.onload = function (event) {
				resolve(event.target.result.toString());
			};
			// Convert data to base64
			reader.readAsDataURL(file);
		});
	}

	public async getFileMimeType(fileUri: URI): Promise<string> {
		let response = await fetch(fileUri.toString());
		let blob = await response.blob();
		return blob.type;
	}
}

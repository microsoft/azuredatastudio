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
			let markdownTextTransformer = new MarkdownTextTransformer(this._notebookService, this.cellModel);
			// Bold Text
			if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
				DOM.EventHelper.stop(e, true);
				await markdownTextTransformer.transformText(MarkdownButtonType.BOLD);
				// Italicize text
			} else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
				DOM.EventHelper.stop(e, true);
				await markdownTextTransformer.transformText(MarkdownButtonType.ITALIC);
				// Underline text
			} else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
				DOM.EventHelper.stop(e, true);
				await markdownTextTransformer.transformText(MarkdownButtonType.UNDERLINE);
				// Code Block
			} else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'k') {
				DOM.EventHelper.stop(e, true);
				await markdownTextTransformer.transformText(MarkdownButtonType.CODE);
				// Highlight Text
			} else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'h') {
				DOM.EventHelper.stop(e, true);
				await markdownTextTransformer.transformText(MarkdownButtonType.HIGHLIGHT);
			}
		}
	}

	public previewFeaturesEnabled: boolean = false;

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
	public insertLinkHeading = localize('callout.insertLinkHeading', "Insert link");
	public insertImageHeading = localize('callout.insertImageHeading', "Insert image");

	public richTextViewButton = localize('richTextViewButton', "Rich Text View");
	public splitViewButton = localize('splitViewButton', "Split View");
	public markdownViewButton = localize('markdownViewButton', "Markdown View");

	private _taskbarContent: Array<ITaskbarContent>;
	private _wysiwygTaskbarContent: Array<ITaskbarContent>;
	private _previewModeTaskbarContent: Array<ITaskbarContent>;
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
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			this.previewFeaturesEnabled = this._configurationService.getValue('workbench.enablePreviewFeatures');
		}));
	}

	ngOnInit() {
		this.initActionBar();
	}

	private initActionBar() {
		this.previewFeaturesEnabled = this._configurationService.getValue('workbench.enablePreviewFeatures');

		let linkButton: TransformMarkdownAction;
		let imageButton: TransformMarkdownAction;
		let linkButtonContainer: HTMLElement;
		let imageButtonContainer: HTMLElement;

		if (this.previewFeaturesEnabled) {
			linkButtonContainer = DOM.$('li.action-item');
			linkButtonContainer.setAttribute('role', 'presentation');
			let linkButton = new Button(linkButtonContainer);
			linkButton.element.setAttribute('class', 'action-label codicon insert-link masked-icon');
			let buttonStyle: IButtonStyles = {
				buttonBackground: null
			};
			linkButton.style(buttonStyle);

			this._register(DOM.addDisposableListener(linkButtonContainer, DOM.EventType.CLICK, async e => {
				await this.onInsertButtonClick(e, MarkdownButtonType.LINK_PREVIEW);
			}));

			imageButtonContainer = DOM.$('li.action-item');
			imageButtonContainer.setAttribute('role', 'presentation');
			let imageButton = new Button(imageButtonContainer);
			imageButton.element.setAttribute('class', 'action-label codicon insert-image masked-icon');

			imageButton.style(buttonStyle);

			this._register(DOM.addDisposableListener(imageButtonContainer, DOM.EventType.CLICK, async e => {
				await this.onInsertButtonClick(e, MarkdownButtonType.IMAGE_PREVIEW);
			}));
		} else {
			linkButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.linkText', '', 'insert-link masked-icon', this.buttonLink, this.cellModel, MarkdownButtonType.LINK);
			imageButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.imageText', '', 'insert-image masked-icon', this.buttonImage, this.cellModel, MarkdownButtonType.IMAGE);
		}

		let boldButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.boldText', '', 'bold masked-icon', this.buttonBold, this.cellModel, MarkdownButtonType.BOLD);
		let italicButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.italicText', '', 'italic masked-icon', this.buttonItalic, this.cellModel, MarkdownButtonType.ITALIC);
		let underlineButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.underlineText', '', 'underline masked-icon', this.buttonUnderline, this.cellModel, MarkdownButtonType.UNDERLINE);
		let highlightButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.highlightText', '', 'highlight masked-icon', this.buttonHighlight, this.cellModel, MarkdownButtonType.HIGHLIGHT);
		let codeButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.codeText', '', 'code masked-icon', this.buttonCode, this.cellModel, MarkdownButtonType.CODE);
		let listButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.listText', '', 'list masked-icon', this.buttonList, this.cellModel, MarkdownButtonType.UNORDERED_LIST);
		let orderedListButton = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.orderedText', '', 'ordered-list masked-icon', this.buttonOrderedList, this.cellModel, MarkdownButtonType.ORDERED_LIST);
		let headingDropdown = this._instantiationService.createInstance(TransformMarkdownAction, 'notebook.heading', '', 'heading', this.dropdownHeading, this.cellModel, null);
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
			'masked-pseudo-after dropdown-arrow',
			this.optionParagraph,
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
			{ action: linkButton },
			{ action: listButton },
			{ action: orderedListButton },
			{ action: imageButton },
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

		this._previewModeTaskbarContent = [
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

		// Hide link and image buttons in WYSIWYG mode
		if (this.cellModel.showPreview && !this.cellModel.showMarkdown) {
			this._actionBar.setContent(this._wysiwygTaskbarContent);
		} else {
			if (this.previewFeaturesEnabled) {
				this._actionBar.setContent(this._previewModeTaskbarContent);
			} else {
				this._actionBar.setContent(this._taskbarContent);
			}
		}
		this._notebookEditor = this._notebookService.findNotebookEditor(this.cellModel?.notebookModel?.notebookUri);
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
				let encodedLinkURL = encodeURI(linkUrl);
				document.execCommand('insertHTML', false, `<a href="${encodedLinkURL}" title="${encodedLinkURL}" is-encoded="true" is-absolute=${notebookLink.isAbsolutePath}>${escape(linkCalloutResult?.insertUnescapedLinkLabel)}</a>`);
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
					let base64String = await this.getFileContentBase64(URI.file(imageCalloutResult.imagePath));
					let mimeType = await this.getFileMimeType(URI.file(imageCalloutResult.imagePath));
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
		if (this.previewFeaturesEnabled) {
			this._actionBar.setContent(this._previewModeTaskbarContent);
		} else {
			this._actionBar.setContent(this._taskbarContent);
		}
	}

	public removeActiveClassFromModeActions() {
		const activeClass = ' active';
		for (let action of [this._toggleTextViewAction, this._toggleSplitViewAction, this._toggleMarkdownViewAction]) {
			if (action.class.includes(activeClass)) {
				action.class = action.class.replace(activeClass, '');
			}
		}
	}

	/**
	 * Instantiate modal for use as callout when inserting Link or Image into markdown.
	 * @param calloutStyle Style of callout passed in to determine which callout is rendered.
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
			this._linkCallout = this._instantiationService.createInstance(LinkCalloutDialog, this.insertLinkHeading, dialogPosition, dialogProperties, defaultLabel, defaultLinkUrl);
			this._linkCallout.render();
			calloutOptions = await this._linkCallout.open();
		} else if (type === MarkdownButtonType.IMAGE_PREVIEW) {
			const imageCallout = this._instantiationService.createInstance(ImageCalloutDialog, this.insertImageHeading, dialogPosition, dialogProperties);
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

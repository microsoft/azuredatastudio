/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./textCell';
import 'vs/css!./media/markdown';
import 'vs/css!./media/highlight';
import * as DOM from 'vs/base/browser/dom';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnChanges, SimpleChange, HostListener, ViewChildren, QueryList } from '@angular/core';
import * as Mark from 'mark.js';

import { localize } from 'vs/nls';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { IColorTheme } from 'vs/platform/theme/common/themeService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { toDisposable } from 'vs/base/common/lifecycle';
import { IMarkdownRenderResult } from 'vs/editor/browser/core/markdownRenderer';

import { NotebookMarkdownRenderer } from 'sql/workbench/contrib/notebook/browser/outputs/notebookMarkdown';
import { CellView } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { ICaretPosition, CellEditModes, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ISanitizer, defaultSanitizer } from 'sql/workbench/services/notebook/browser/outputs/sanitizer';
import { CodeComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/code.component';
import { NotebookRange, ICellEditorProvider, INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { HTMLMarkdownConverter } from 'sql/workbench/contrib/notebook/browser/htmlMarkdownConverter';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';

export const TEXT_SELECTOR: string = 'text-cell-component';
const USER_SELECT_CLASS = 'actionselect';
const findHighlightClass = 'rangeHighlight';
const findRangeSpecificClass = 'rangeSpecificHighlight';
@Component({
	selector: TEXT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./textCell.component.html'))
})
export class TextCellComponent extends CellView implements OnInit, OnChanges {
	@ViewChild('preview', { read: ElementRef }) private output: ElementRef;
	@ViewChildren(CodeComponent) private markdowncodeCell: QueryList<CodeComponent>;

	@Input() cellModel: ICellModel;

	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	@HostListener('document:keydown.escape', ['$event'])
	handleKeyboardEvent() {
		if (this.isEditMode) {
			this.toggleEditMode(false);
		}
		this.cellModel.active = false;
		this._model.updateActiveCell(undefined);
	}

	// Double click to edit text cell in notebook
	@HostListener('dblclick', ['$event']) onDblClick() {
		this.enableActiveCellEditOnDoubleClick();
	}

	@HostListener('document:keydown', ['$event'])
	onkeydown(e: KeyboardEvent) {
		if (DOM.getActiveElement() === this.output?.nativeElement && this.isActive() && this.cellModel?.currentMode === CellEditModes.WYSIWYG) {
			// Select all text
			if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
				preventDefaultAndExecCommand(e, 'selectAll');
				// Redo text
			} else if ((e.metaKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y') && !this.markdownMode) {
				this.redoRichTextChange();
				// Undo text
			} else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
				this.undoRichTextChange();
				// Outdent text
			} else if (e.shiftKey && e.key === 'Tab') {
				preventDefaultAndExecCommand(e, 'outdent');
				// Indent text
			} else if (e.key === 'Tab') {
				preventDefaultAndExecCommand(e, 'indent');
				// Bold text
			} else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
				preventDefaultAndExecCommand(e, 'bold');
				// Italicize text
			} else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
				preventDefaultAndExecCommand(e, 'italic');
				// Underline text
			} else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
				preventDefaultAndExecCommand(e, 'underline');
				// Code Block
			} else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'k') {
				preventDefaultAndExecCommand(e, 'formatBlock', false, 'pre');
			}
		}
	}

	private _content: string | string[];
	private _lastTrustedMode: boolean;
	private isEditMode: boolean;
	private _previewMode: boolean = true;
	private _markdownMode: boolean;
	private _sanitizer: ISanitizer;
	private _model: NotebookModel;
	private _activeCellId: string;
	private readonly _onDidClickLink = this._register(new Emitter<URI>());
	private markdownRenderer: NotebookMarkdownRenderer;
	private markdownResult: IMarkdownRenderResult;
	private _htmlMarkdownConverter: HTMLMarkdownConverter;
	private markdownPreviewLineHeight: number;
	public readonly onDidClickLink = this._onDidClickLink.event;
	public previewFeaturesEnabled: boolean = false;
	public doubleClickEditEnabled: boolean;
	private _highlightRange: NotebookRange;
	private _isFindActive: boolean = false;
	private _editorHeight: number;
	private readonly _markdownMaxHeight = 4000;

	private readonly _undoStack: RichTextEditStack;
	private readonly _redoStack: RichTextEditStack;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService,
		@Inject(INotebookService) private _notebookService: INotebookService
	) {
		super();
		this.markdownRenderer = this._instantiationService.createInstance(NotebookMarkdownRenderer);
		this.doubleClickEditEnabled = this._configurationService.getValue('notebook.enableDoubleClickEdit');
		this.markdownPreviewLineHeight = this._configurationService.getValue('notebook.markdownPreviewLineHeight');
		let maxStackSize: number = this._configurationService.getValue('notebook.maxRichTextUndoHistory');
		this._undoStack = new RichTextEditStack(maxStackSize);
		this._redoStack = new RichTextEditStack(maxStackSize);

		this._register(toDisposable(() => {
			if (this.markdownResult) {
				this.markdownResult.dispose();
			}
		}));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			this.previewFeaturesEnabled = this._configurationService.getValue('workbench.enablePreviewFeatures');
			this.doubleClickEditEnabled = this._configurationService.getValue('notebook.enableDoubleClickEdit');
			if (e.affectsConfiguration('notebook.markdownPreviewLineHeight')) {
				this.markdownPreviewLineHeight = this._configurationService.getValue('notebook.markdownPreviewLineHeight');
				this.updatePreview();
			}
			if (e.affectsConfiguration('notebook.maxRichTextUndoHistory')) {
				let newStackSize: number = this._configurationService.getValue('notebook.maxRichTextUndoHistory');
				this._undoStack.maxStackSize = newStackSize;
				this._redoStack.maxStackSize = newStackSize;
			}
		}));
	}

	public get cellEditors(): ICellEditorProvider[] {
		let editors: ICellEditorProvider[] = [];
		if (this.markdowncodeCell) {
			editors.push(...this.markdowncodeCell.toArray());
		}
		return editors;
	}

	//Gets sanitizer from ISanitizer interface
	private get sanitizer(): ISanitizer {
		if (this._sanitizer) {
			return this._sanitizer;
		}
		return this._sanitizer = defaultSanitizer;
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	get outputRef(): ElementRef {
		return this.output;
	}

	private setLoading(isLoading: boolean): void {
		this.cellModel.loaded = !isLoading;
		this._changeRef.detectChanges();
	}

	ngOnInit() {
		this._editorHeight = document.querySelector('.editor-container').clientHeight;
		this.previewFeaturesEnabled = this._configurationService.getValue('workbench.enablePreviewFeatures');
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.setFocusAndScroll();
		this.cellModel.isEditMode = false;
		this._htmlMarkdownConverter = this._instantiationService.createInstance(HTMLMarkdownConverter, this.notebookUri);
		this._register(this.cellModel.onOutputsChanged(e => {
			this.updatePreview();
		}));
		this._register(this.cellModel.onCellModeChanged(mode => {
			if (mode !== this.isEditMode) {
				this.toggleEditMode(mode);
			}
			this._changeRef.detectChanges();
		}));
		this._register(this.cellModel.onCellPreviewModeChanged(preview => {
			// On preview mode change, get the cursor position (get the position only when the selection node is a text node)
			if (window.getSelection() && window.getSelection().focusNode?.nodeName === '#text' && window.getSelection().getRangeAt(0)) {
				let selection = window.getSelection().getRangeAt(0);
				if (selection.startOffset !== this.cellModel.richTextCursorPosition?.startOffset) {
					// window.getSelection gives the exact html element and offsets of cursor location
					// Since we only have the output element reference which is the parent of all html nodes
					// we iterate through it's child nodes until we get the selection element and store the node indexes
					// in the startElementNodes and endElementNodes and their offsets respectively.
					let startElementNodes = [];
					let startNode = selection.startContainer;
					let endNode = selection.endContainer;
					while (startNode !== this.output.nativeElement) {
						startElementNodes.push(this.getNodeIndex(startNode));
						startNode = startNode.parentNode;
					}
					let endElementNodes = [];
					while (endNode !== this.output.nativeElement) {
						endElementNodes.push(this.getNodeIndex(endNode));
						endNode = endNode.parentNode;
					}
					// Create cursor position
					let cursorPosition: ICaretPosition = {
						startElementNodes: startElementNodes,
						startOffset: selection.startOffset,
						endElementNodes: endElementNodes,
						endOffset: selection.endOffset
					};
					this.cellModel.richTextCursorPosition = cursorPosition;
				}
			}
			this.previewMode = preview;
			this.focusIfPreviewMode();
		}));
		this._register(this.cellModel.onCellMarkdownModeChanged(markdown => {
			if (!markdown) {
				let editorControl = this.cellEditors.length > 0 ? this.cellEditors[0].getEditor().getControl() : undefined;
				if (editorControl) {
					let selection = editorControl.getSelection();
					this.cellModel.markdownCursorPosition = selection?.getPosition();
				}
			}
			this.markdownMode = markdown;
			this.focusIfPreviewMode();
		}));
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				this._activeCellId = changedProp.currentValue;
				this.toggleUserSelect(this.isActive());
				// If the activeCellId is undefined (i.e. in an active cell update), don't unnecessarily set editMode to false;
				// it will be set to true in a subsequent call to toggleEditMode()
				if (changedProp.previousValue !== undefined) {
					this.toggleEditMode(false);
				}
				break;
			}
		}
	}

	getNodeIndex(n) {
		let i = 0; while (n = n.previousSibling) { i++; }
		return i;
	}

	public cellGuid(): string {
		return this.cellModel.cellGuid;
	}

	public get isTrusted(): boolean {
		return this.model.trustedMode;
	}

	public get notebookUri(): URI {
		return this.model.notebookUri;
	}

	/**
	 * Updates the preview of markdown component with latest changes
	 * If content is empty and in non-edit mode, default it to 'Add content here...' or 'Double-click to edit' depending on setting
	 * Sanitizes the data to be shown in markdown cell
	 */
	private updatePreview(): void {
		let trustedChanged = this.cellModel && this._lastTrustedMode !== this.cellModel.trustedMode;
		let cellModelSourceJoined = Array.isArray(this.cellModel.source) ? this.cellModel.source.join('') : this.cellModel.source;
		let contentJoined = Array.isArray(this._content) ? this._content.join('') : this._content;
		let contentChanged = contentJoined !== cellModelSourceJoined || cellModelSourceJoined.length === 0 || this._previewMode === true;
		if (trustedChanged || contentChanged) {
			this._lastTrustedMode = this.cellModel.trustedMode;
			if ((!cellModelSourceJoined) && !this.isEditMode) {
				if (this.doubleClickEditEnabled) {
					this._content = localize('doubleClickEdit', "<i>Double-click to edit</i>");
				} else {
					this._content = localize('addContent', "<i>Add content here...</i>");
				}
			} else {
				this._content = this.cellModel.source;
			}
			this.markdownRenderer.setNotebookURI(this.cellModel.notebookModel.notebookUri);
			this.markdownResult = this.markdownRenderer.render({
				isTrusted: true,
				value: Array.isArray(this._content) ? this._content.join('') : this._content,
				cellAttachments: this.cellModel.attachments
			});
			this.markdownResult.element.innerHTML = this.sanitizeContent(this.markdownResult.element.innerHTML);
			this.setLoading(false);
			if (this._previewMode) {
				let outputElement = <HTMLElement>this.output.nativeElement;
				outputElement.innerHTML = this.markdownResult.element.innerHTML;
				this.addUndoElement(outputElement.innerHTML);
				if (this.markdownMode) {
					this.setSplitViewHeight();
				}
				outputElement.style.lineHeight = this.markdownPreviewLineHeight.toString();
				this.cellModel.renderedOutputTextContent = this.getRenderedTextOutput();
				outputElement.focus();
				if (this._isFindActive) {
					this.addDecoration();
				}
			}
		}
	}

	private setSplitViewHeight(): void {
		// Set the same height for markdown editor and preview
		this.setMarkdownEditorHeight(this._editorHeight);
		let outputElement = <HTMLElement>this.output.nativeElement;
		outputElement.style.maxHeight = this._editorHeight.toString() + 'px';
		outputElement.style.overflowY = 'scroll';
	}

	private setMarkdownEditorHeight(height: number): void {
		// Find cell editor provider via cell guid to set markdown editor max height
		let cellEditorProvider = this.markdowncodeCell.find(c => c.cellGuid() === this.cellModel.cellGuid);
		let markdownEditor = cellEditorProvider?.getEditor();
		if (markdownEditor) {
			markdownEditor.setMaximumHeight(height);
		}
	}

	private updateCellSource(): void {
		let textOutputElement = <HTMLElement>this.output.nativeElement;
		let newCellSource: string = this._htmlMarkdownConverter.convert(textOutputElement.innerHTML);
		// reset cell attachments to remove unused image data since we're going to go through each of them again
		this.cellModel.attachments = {};
		this.cellModel.source = newCellSource;
		this._changeRef.detectChanges();
	}

	private addUndoElement(newText: string) {
		if (newText !== this._undoStack.peek()) {
			this._redoStack.clear();
			this._undoStack.push(newText);
		}
	}

	private undoRichTextChange(): void {
		// The first element in the undo stack is the initial cell text,
		// which is the hard stop for undoing text changes. So we can only
		// undo text changes after that one.
		if (this._undoStack.count > 1) {
			// The most recent change is at the top of the undo stack, so we want to
			// update the text so that it's the change just before that.
			let redoText = this._undoStack.pop();
			this._redoStack.push(redoText);
			let undoText = this._undoStack.peek();

			let textOutputElement = <HTMLElement>this.output.nativeElement;
			textOutputElement.innerHTML = undoText;

			this.updateCellSource();
		}
	}

	private redoRichTextChange(): void {
		if (this._redoStack.count > 0) {
			let text = this._redoStack.pop();
			this._undoStack.push(text);

			let textOutputElement = <HTMLElement>this.output.nativeElement;
			textOutputElement.innerHTML = text;

			this.updateCellSource();
		}
	}

	//Sanitizes the content based on trusted mode of Cell Model
	private sanitizeContent(content: string): string {
		if (this.cellModel && !this.cellModel.trustedMode) {
			content = this.sanitizer.sanitize(content);
		}
		return content;
	}

	// Todo: implement layout
	public layout() {
	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.output?.nativeElement;
		if (outputElement) {
			outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
		}
	}

	public handleContentChanged(): void {
		this.updatePreview();
	}

	public handleHtmlChanged(): void {
		let textOutputElement = <HTMLElement>this.output.nativeElement;
		this.addUndoElement(textOutputElement.innerHTML);

		this.updateCellSource();
	}

	public toggleEditMode(editMode?: boolean): void {
		this.isEditMode = editMode !== undefined ? editMode : !this.isEditMode;
		this.cellModel.isEditMode = this.isEditMode;
		if (!this.isEditMode) {
			this.cellModel.showPreview = true;
			this.cellModel.showMarkdown = false;
		} else {
			this.markdownMode = this.cellModel.showMarkdown;
		}
		this.updatePreview();
		this._changeRef.detectChanges();
	}

	public get previewMode(): boolean {
		return this._previewMode;
	}
	public set previewMode(value: boolean) {
		if (this._previewMode !== value) {
			this._previewMode = value;
			this.updatePreview();
			this._changeRef.detectChanges();
		}
	}

	public get markdownMode(): boolean {
		return this._markdownMode;
	}
	public set markdownMode(value: boolean) {
		if (this._markdownMode !== value) {
			this._markdownMode = value;
			this._changeRef.detectChanges();
		}
	}

	private toggleUserSelect(userSelect: boolean): void {
		if (!this.output) {
			return;
		}
		if (userSelect) {
			this.output.nativeElement.classList.add(USER_SELECT_CLASS);
		} else {
			this.output.nativeElement.classList.remove(USER_SELECT_CLASS);
		}
	}

	private setFocusAndScroll(): void {
		this.toggleEditMode(this.isActive());

		if (this.output && this.output.nativeElement) {
			let outputElement = this.output.nativeElement as HTMLElement;
			outputElement.scrollTo({ behavior: 'smooth' });
		}
	}

	private focusIfPreviewMode(): void {
		if (this.previewMode) {
			if (!this.markdownMode) {
				let outputElement = this.output?.nativeElement as HTMLElement;
				if (outputElement) {
					outputElement.style.maxHeight = 'unset';
					outputElement.focus();
				}
			} else {
				this.setSplitViewHeight();
			}
			// Move cursor to the richTextCursorPosition
			// We iterate through the output element childnodes to get to the element of cursor location
			// If the elements exist, we set the selection, else the cursor defaults to beginning.
			if (!this.markdownMode && this.cellModel.richTextCursorPosition) {
				let selection = window.getSelection();
				let htmlNodes = this.cellModel.richTextCursorPosition.startElementNodes;
				let depthToNode = htmlNodes.length;
				let startNodeElement: any = this.output.nativeElement;
				while (depthToNode-- && startNodeElement) {
					startNodeElement = startNodeElement.childNodes[htmlNodes[depthToNode]];
				}
				htmlNodes = this.cellModel.richTextCursorPosition.endElementNodes;
				depthToNode = htmlNodes.length;
				let endNodeElement: any = this.output.nativeElement;
				while (depthToNode-- && endNodeElement) {
					endNodeElement = endNodeElement?.childNodes[htmlNodes[depthToNode]];
				}
				// check to see if the nodes exist and set the cursor
				if (startNodeElement && endNodeElement) {
					let range = document.createRange();
					if (startNodeElement.length >= this.cellModel.richTextCursorPosition.startOffset && endNodeElement.length >= this.cellModel.richTextCursorPosition.endOffset) {
						range.setStart(startNodeElement, this.cellModel.richTextCursorPosition.startOffset);
						range.setEnd(endNodeElement, this.cellModel.richTextCursorPosition.endOffset);
						selection.removeAllRanges();
						selection.addRange(range);
					}
				}
			}
		} else {
			this.setMarkdownEditorHeight(this._markdownMaxHeight);
		}
	}

	protected isActive(): boolean {
		return this.cellModel && this.cellModel.id === this.activeCellId;
	}

	public override deltaDecorations(newDecorationsRange: NotebookRange | NotebookRange[], oldDecorationsRange: NotebookRange | NotebookRange[]): void {
		if (newDecorationsRange) {
			this._isFindActive = true;
			if (Array.isArray(newDecorationsRange)) {
				this.highlightAllMatches();
			} else {
				this._highlightRange = newDecorationsRange;
				this.addDecoration(newDecorationsRange);
			}
		}
		if (oldDecorationsRange) {
			if (Array.isArray(oldDecorationsRange)) {
				this.removeDecoration();
				this._isFindActive = false;
			} else {
				this._highlightRange = oldDecorationsRange === this._highlightRange ? undefined : this._highlightRange;
				this.removeDecoration(oldDecorationsRange);
			}
		}
	}

	private addDecoration(range?: NotebookRange): void {
		range = range ?? this._highlightRange;
		if (this.output && this.output.nativeElement) {
			this.highlightAllMatches();
			if (range) {
				let elements = this.getHtmlElements();
				if (elements?.length >= range.startLineNumber) {
					let elementContainingText = elements[range.startLineNumber - 1];
					let markCurrent = new Mark(elementContainingText); // to highlight the current item of them all.

					markCurrent.markRanges([{
						start: range.startColumn - 1, //subtracting 1 since markdown html is 0 indexed.
						length: range.endColumn - range.startColumn
					}], {
						className: findRangeSpecificClass,
						each: function (node, range) {
							// node is the marked DOM element
							node.scrollIntoView({ behavior: 'smooth', block: 'center' });
						}
					});
				}
			}
		}
	}

	private highlightAllMatches(): void {
		if (this.output && this.output.nativeElement) {
			let markAllOccurances = new Mark(this.output.nativeElement); // to highlight all occurances in the element.
			let editor = this._notebookService.findNotebookEditor(this.model.notebookUri);
			if (editor) {
				let findModel = (editor.notebookParams.input as NotebookInput).notebookFindModel;
				if (findModel?.findMatches?.length > 0) {
					let searchString = findModel.findExpression;
					markAllOccurances.mark(searchString, {
						className: findHighlightClass
					});
				}
			}
		}
	}

	private removeDecoration(range?: NotebookRange): void {
		if (this.output && this.output.nativeElement) {
			if (range) {
				let elements = this.getHtmlElements();
				let elementContainingText = elements[range.startLineNumber - 1];
				let markCurrent = new Mark(elementContainingText);
				markCurrent.unmark({ acrossElements: true, className: findRangeSpecificClass });
			} else {
				let markAllOccurances = new Mark(this.output.nativeElement);
				markAllOccurances.unmark({ acrossElements: true, className: findHighlightClass });
				markAllOccurances.unmark({ acrossElements: true, className: findRangeSpecificClass });
				this._highlightRange = undefined;
			}
		}
	}

	private getHtmlElements(): any[] {
		let hostElem = this.output?.nativeElement;
		let children = [];
		if (hostElem) {
			for (let element of hostElem.children) {
				if (element.nodeName.toLowerCase() === 'table') {
					// add table header and table rows.
					if (element.children.length > 0) {
						children.push(element.children[0]);
						if (element.children.length > 1) {
							for (let trow of element.children[1].children) {
								children.push(trow);
							}
						}
					}
				} else if (element.children.length > 1) {
					children = children.concat(this.getChildren(element));
				} else {
					children.push(element);
				}
			}
		}
		return children;
	}

	private getChildren(parent: any): any[] {
		let children: any = [];
		if (parent.children.length > 1 && parent.nodeName.toLowerCase() !== 'li' && parent.nodeName.toLowerCase() !== 'p') {
			for (let child of parent.children) {
				children = children.concat(this.getChildren(child));
			}
		} else {
			return parent;
		}
		return children;
	}

	private getRenderedTextOutput(): string[] {
		let textOutput: string[] = [];
		let elements = this.getHtmlElements();
		elements.forEach(element => {
			if (element && element.textContent) {
				textOutput.push(element.textContent);
			} else {
				textOutput.push('');
			}
		});
		return textOutput;
	}

	// Enables edit mode on double clicking active cell
	private enableActiveCellEditOnDoubleClick() {
		if (!this.isEditMode && this.doubleClickEditEnabled) {
			this.toggleEditMode(true);
		}
		this.cellModel.active = true;
		this._model.updateActiveCell(this.cellModel);
	}
}

function preventDefaultAndExecCommand(e: KeyboardEvent, commandId: string, showUI?: boolean, value?: string) {
	// Use preventDefault() to avoid invoking the editor's select all and stopPropagation to prevent further propagation of the current event
	e.stopPropagation();
	e.preventDefault();
	document.execCommand(commandId, showUI, value);
}

/**
 * A string stack used to track changes to Undo and Redo for the Rich Text editor in text cells.
 */
export class RichTextEditStack {
	private _list: string[] = [];

	constructor(private _maxStackSize: number) {
	}

	public set maxStackSize(stackSize: number) {
		this._maxStackSize = stackSize;
	}

	/**
	 * Adds an element to the top of the stack. If the number of elements
	 * exceeds the max stack size, then the oldest elements are removed until
	 * the max size is reached.
	 * @param element The string element to add to the stack.
	 */
	public push(element: string): void {
		this._list.push(element);
		if (this._list.length > this._maxStackSize) {
			this._list = this._list.slice(this._list.length - this._maxStackSize);
		}
	}

	/**
	 * Removes the topmost element of the stack and returns it.
	 */
	public pop(): string | undefined {
		return this._list.pop();
	}

	/**
	 * Returns the topmost element of the stack without removing it.
	 */
	public peek(): string | undefined {
		if (this._list.length > 0) {
			return this._list[this._list.length - 1];
		} else {
			return undefined;
		}
	}

	/**
	 * Removes all elements from the stack.
	 */
	public clear(): void {
		this._list = [];
	}

	/**
	 * Returns the number of elements in the stack.
	 */
	public get count(): number {
		return this._list.length;
	}
}

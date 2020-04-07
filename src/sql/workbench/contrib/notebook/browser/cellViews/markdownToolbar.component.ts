/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./markdownToolbar';
import { Component, Input, Inject } from '@angular/core';
import { localize } from 'vs/nls';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INotebookService, INotebookEditor } from 'sql/workbench/services/notebook/browser/notebookService';
import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { TextModel } from 'vs/editor/common/model/textModel';
import { IRange } from 'vs/editor/common/core/range';
import { IIdentifiedSingleEditOperation } from 'vs/editor/common/model';

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

	public get cellModel(): ICellModel {
		return this._cellModel;
	}

	@Input() public set cellModel(value: ICellModel) {
		this._cellModel = value;
	}

	private _cellModel: ICellModel;
	private _notebookEditor: INotebookEditor;


	constructor(
		@Inject(INotebookService) private _notebookService: INotebookService
	) { }

	ngOnInit() {
		// Notebook editor object is available when this component is initialized
		this._notebookEditor = this._notebookService.findNotebookEditor(this._cellModel.notebookModel.notebookUri);
	}

	public changeSelection(type: MarkdownButtonType): void {
		if (!this._notebookEditor) {
			this._notebookEditor = this._notebookService.findNotebookEditor(this._cellModel.notebookModel.notebookUri);
		}
		if (this._notebookEditor && this._notebookEditor.cellEditors && this._notebookEditor.cellEditors.length > 0) {
			// Find cell editor provider via cell guid
			let cellEditorProvider = this._notebookEditor.cellEditors.find(e => e.cellGuid() === this._cellModel.cellGuid);
			if (cellEditorProvider) {
				let editor = cellEditorProvider.getEditor() as QueryTextEditor;
				if (editor) {
					let editorControl = editor.getControl() as CodeEditorWidget;
					if (editorControl) {
						let selections = editorControl.getSelections();
						// TODO: Support replacement for multiple selections
						let selection = selections[0];
						let startRange: IRange = {
							startColumn: selection.startColumn,
							endColumn: selection.startColumn,
							startLineNumber: selection.startLineNumber,
							endLineNumber: selection.startLineNumber
						};

						let beginInsertedCode = this.getStartTextToInsert(type);
						let endInsertedCode = this.getEndTextToInsert(type);
						// endInsertedCode can be an empty string, so no need to check for that as well
						if (beginInsertedCode) {
							let selection = selections[0];
							// If end is on same line as beginning, need to add offset for number of characters inserted
							let offset = selection.startLineNumber === selection.endLineNumber ? beginInsertedCode.length : 0;
							let endRange: IRange = {
								startColumn: selection.endColumn + offset,
								endColumn: selection.endColumn + offset,
								startLineNumber: selection.endLineNumber,
								endLineNumber: selection.endLineNumber
							};
							let editorModel = editorControl.getModel() as TextModel;
							let markdownLineType = this.getMarkdownLineType(type);
							if (markdownLineType === MarkdownLineType.SINGLE_LINE) {
								editorModel.pushEditOperations(selections, [{ range: startRange, text: beginInsertedCode }, { range: endRange, text: endInsertedCode }], null);
							} else {
								let operations: IIdentifiedSingleEditOperation[] = [];
								for (let i = 0; i < selection.endLineNumber - selection.startLineNumber + 1; i++) {
									operations.push({ range: this.transformRangeByLineOffset(startRange, i), text: beginInsertedCode });
								}
								operations.push({ range: endRange, text: endInsertedCode });
								editorModel.pushEditOperations(selections, operations, null);
							}
							this.setSelection(endRange, type, editorControl);
						} else {
							// eslint-disable-next-line no-throw-literal
							throw 'Invalid button type';
						}
					}
				}
			}
		}
	}

	// For items like lists (where we need to insert a character at the beginning of n lines), create
	// range object for that range
	private transformRangeByLineOffset(range: IRange, lineOffset: number): IRange {
		return {
			startColumn: lineOffset === 0 ? range.startColumn : 1,
			endColumn: range.endColumn,
			startLineNumber: range.endLineNumber + lineOffset,
			endLineNumber: range.endLineNumber + lineOffset
		};
	}

	private getStartTextToInsert(type: MarkdownButtonType): string {
		switch (type) {
			case MarkdownButtonType.BOLD:
				return '**';
			case MarkdownButtonType.ITALIC:
				return '_';
			case MarkdownButtonType.CODE:
				return '```\n';
			case MarkdownButtonType.LINK:
				return '[';
			case MarkdownButtonType.UNORDEREDLIST:
				return '- ';
			case MarkdownButtonType.ORDEREDLIST:
				return '1. ';
			default:
				return '';
		}
	}

	private getEndTextToInsert(type: MarkdownButtonType): string {
		switch (type) {
			case MarkdownButtonType.BOLD:
				return '**';
			case MarkdownButtonType.ITALIC:
				return '_';
			case MarkdownButtonType.CODE:
				return '\n```';
			case MarkdownButtonType.LINK:
				return ']()';
			case MarkdownButtonType.UNORDEREDLIST:
			case MarkdownButtonType.ORDEREDLIST:
			default:
				return '';
		}
	}

	private getMarkdownLineType(type: MarkdownButtonType): MarkdownLineType {
		switch (type) {
			case MarkdownButtonType.UNORDEREDLIST:
			case MarkdownButtonType.ORDEREDLIST:
				return MarkdownLineType.MULTI_LINE;
			default:
				return MarkdownLineType.SINGLE_LINE;
		}
	}

	private setSelection(range: IRange, type: MarkdownButtonType, editorControl: CodeEditorWidget) {
		if (type === MarkdownButtonType.LINK) {
			let newRange: IRange = {
				startColumn: range.startColumn + 2,
				endColumn: range.endColumn + 2,
				startLineNumber: range.startLineNumber,
				endLineNumber: range.endLineNumber
			};
			editorControl.setSelection(newRange);
			editorControl.focus();
		}
	}
}

export enum MarkdownButtonType {
	BOLD = 0,
	ITALIC = 1,
	CODE = 2,
	LINK = 3,
	UNORDEREDLIST = 4,
	ORDEREDLIST = 5,
	IMAGE = 6
}

export enum MarkdownLineType {
	SINGLE_LINE,
	MULTI_LINE
}

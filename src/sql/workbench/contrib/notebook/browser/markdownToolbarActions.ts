/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { INotebookEditor, INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { IRange, Range } from 'vs/editor/common/core/range';
import { IIdentifiedSingleEditOperation } from 'vs/editor/common/model';
import { TextModel } from 'vs/editor/common/model/textModel';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import { Selection } from 'vs/editor/common/core/selection';
import { ToggleableAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { EditOperation } from 'vs/editor/common/core/editOperation';
import { Position } from 'vs/editor/common/core/position';


export class TransformMarkdownAction extends Action {

	constructor(
		id: string,
		label: string,
		cssClass: string,
		tooltip: string,
		private _cellModel: ICellModel,
		private _type: MarkdownButtonType,
		@INotebookService private _notebookService: INotebookService
	) {
		super(id, label, cssClass);
		this._tooltip = tooltip;
	}
	public run(context: any): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			try {
				let markdownTextTransformer = new MarkdownTextTransformer(this._notebookService, this._cellModel);
				markdownTextTransformer.transformText(this._type);
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class MarkdownTextTransformer {

	constructor(private _notebookService: INotebookService, private _cellModel: ICellModel, private _notebookEditor?: INotebookEditor) { }

	public get notebookEditor(): INotebookEditor {
		return this._notebookEditor;
	}

	public transformText(type: MarkdownButtonType): void {
		let editorControl = this.getEditorControl();
		if (editorControl) {
			let selections = editorControl.getSelections();
			// TODO: Support replacement for multiple selections
			let selection = selections[0];
			let nothingSelected = this.editorHasNoSelection(selection);
			let startRange: IRange = {
				startColumn: selection.startColumn,
				endColumn: selection.startColumn,
				startLineNumber: selection.startLineNumber,
				endLineNumber: selection.startLineNumber
			};

			let beginInsertedText = getStartTextToInsert(type);
			let endInsertedText = getEndTextToInsert(type);

			let endRange: IRange = {
				startColumn: selection.endColumn,
				endColumn: selection.endColumn,
				startLineNumber: selection.endLineNumber,
				endLineNumber: selection.endLineNumber
			};

			let editorModel = editorControl.getModel() as TextModel;
			let isUndo = false;
			if (editorModel) {
				let markdownLineType = getMarkdownLineType(type);
				// Paragraph (empty string) is just used for replacing any existing headers so will never be an undo operation
				isUndo = beginInsertedText && this.isUndoOperation(selection, type, markdownLineType, editorModel);
				if (isUndo) {
					this.handleUndoOperation(markdownLineType, startRange, endRange, editorModel, beginInsertedText, endInsertedText, selections, selection);
				} else {
					this.handleTransformOperation(markdownLineType, type, startRange, endRange, editorModel, beginInsertedText, endInsertedText, selections, selection);
				}
			}

			// If selection end is on same line as beginning, need to add offset for number of characters inserted
			// Otherwise, the selection will not be correct after the transformation
			let offset = selection.startLineNumber === selection.endLineNumber ? beginInsertedText.length : 0;
			endRange = this.getIRangeWithOffsets(endRange, offset, 0, offset, 0);
			this.setEndSelection(endRange, type, editorControl, editorModel, nothingSelected, isUndo);
			// Always give focus back to the editor after pressing the button
			editorControl.focus();
		}
	}

	private getEditorControl(): CodeEditorWidget | undefined {
		if (!this._notebookEditor) {
			this._notebookEditor = this._notebookService.findNotebookEditor(this._cellModel?.notebookModel?.notebookUri);
		}
		if (this._notebookEditor?.cellEditors?.length > 0) {
			// Find cell editor provider via cell guid
			let cellEditorProvider = this._notebookEditor.cellEditors.find(e => e.cellGuid() === this._cellModel.cellGuid);
			if (cellEditorProvider) {
				let editor = cellEditorProvider.getEditor() as QueryTextEditor;
				if (editor) {
					let editorControl = editor.getControl() as CodeEditorWidget;
					return editorControl;
				}
			}
		}
		return undefined;
	}

	private editorHasNoSelection(selection: Selection): boolean {
		return !selection || (selection.startLineNumber === selection.endLineNumber && selection.startColumn === selection.endColumn);
	}

	/**
	 * Sets the end selection state after the transform has occurred
	 * @param endRange range for end text that was inserted
	 * @param type MarkdownButtonType
	 * @param editorControl code editor widget
	 * @param noSelection controls whether there was no previous selection in the editor
	 */
	private setEndSelection(endRange: IRange, type: MarkdownButtonType, editorControl: CodeEditorWidget, editorModel: TextModel, noSelection: boolean, isUndo: boolean): void {
		if (!endRange || !editorControl || isUndo) {
			return;
		}
		let offset = getColumnOffsetForSelection(type, noSelection);
		if (offset > -1) {
			let newRange: IRange;
			if (type !== MarkdownButtonType.CODE) {
				newRange = {
					startColumn: endRange.startColumn + offset,
					startLineNumber: endRange.startLineNumber,
					endColumn: endRange.startColumn + offset,
					endLineNumber: endRange.endLineNumber
				};
			} else {
				newRange = {
					startColumn: 1,
					startLineNumber: endRange.startLineNumber + 1,
					endColumn: 1,
					endLineNumber: endRange.endLineNumber + 1
				};
			}
			editorControl.setSelection(newRange);
		} else {
			let markdownLineType = getMarkdownLineType(type);
			let currentSelection = editorControl.getSelection();
			if (markdownLineType === MarkdownLineType.BEGIN_AND_END_LINES) {
				editorControl.setSelection({
					startColumn: currentSelection.startColumn + getStartTextToInsert(type).length,
					startLineNumber: currentSelection.startLineNumber,
					endColumn: currentSelection.endColumn - getEndTextToInsert(type).length,
					endLineNumber: currentSelection.endLineNumber
				});
			} else if (markdownLineType === MarkdownLineType.WRAPPED_ABOVE_AND_BELOW) {
				// Subtracting 1 because the last line will have the end text (e.g. ``` for code)
				let endLineLength = editorModel.getLineLength(currentSelection.endLineNumber - 1);
				editorControl.setSelection({
					startColumn: 1,
					startLineNumber: currentSelection.startLineNumber + 1,
					endColumn: endLineLength + 1,
					endLineNumber: currentSelection.endLineNumber - 1
				});
			}
		}
	}

	/**
	 * Determine if user wants to perform an undo operation
	 * @param selection current user selection
	 * @param type markdown button type
	 * @param lineType markdown line type
	 * @param editorModel text model for the cell
	 */
	private isUndoOperation(selection: Selection, type: MarkdownButtonType, lineType: MarkdownLineType, editorModel: TextModel): boolean {
		if (lineType === MarkdownLineType.BEGIN_AND_END_LINES || lineType === MarkdownLineType.WRAPPED_ABOVE_AND_BELOW) {
			const selectedText = this.getExtendedSelectedText(selection, type, lineType, editorModel);
			return selectedText && selectedText.startsWith(getStartTextToInsert(type)) && selectedText.endsWith(getEndTextToInsert(type));
		} else {
			return this.everyLineMatchesBeginString(selection, type, editorModel);
		}
	}

	private handleUndoOperation(markdownLineType: MarkdownLineType, startRange: IRange, endRange: IRange, editorModel: TextModel, beginInsertedCode: string, endInsertedCode: string, selections: Selection[], selection: Selection): void {
		if (markdownLineType === MarkdownLineType.BEGIN_AND_END_LINES) {
			startRange = this.getIRangeWithOffsets(startRange, -1 * beginInsertedCode.length, 0, 0, 0);
			endRange = this.getIRangeWithOffsets(endRange, 0, 0, endInsertedCode.length, 0);
			editorModel.pushEditOperations(selections, [{ range: endRange, text: '' }, { range: startRange, text: '' }], undefined);
		} else if (markdownLineType === MarkdownLineType.WRAPPED_ABOVE_AND_BELOW) {
			// Delete the entire rows above and below the current selection
			const startLineRange = new Range(startRange.startLineNumber - 1, 1, startRange.startLineNumber, 1);
			const endLineRange = new Range(endRange.startLineNumber, editorModel.getLineLength(endRange.startLineNumber) + 1, endRange.startLineNumber + 1, endInsertedCode.length + 1);
			editorModel.pushEditOperations(selections, [EditOperation.delete(endLineRange), EditOperation.delete(startLineRange)], undefined);
		} else if (markdownLineType === MarkdownLineType.EVERY_LINE) {
			let operations: IIdentifiedSingleEditOperation[] = [];
			for (let i = selection.startLineNumber; i <= selection.endLineNumber; i++) {
				// If we're in an undo operation we already verified that every line starts with the expected text
				// Create the edit operation to delete the text for every line
				operations.push(EditOperation.delete(new Range(i, 1, i, beginInsertedCode.length + 1)));
			}
			editorModel.pushEditOperations(selections, operations, undefined);
		}
	}

	private handleTransformOperation(markdownLineType: MarkdownLineType, markdownButtonType: MarkdownButtonType, startRange: IRange, endRange: IRange, editorModel: TextModel, beginInsertedCode: string, endInsertedCode: string, selections: Selection[], selection: Selection): void {
		// If the markdown we're inserting only needs to be added to the begin and end lines, add those edit operations directly
		if (markdownLineType === MarkdownLineType.BEGIN_AND_END_LINES || markdownLineType === MarkdownLineType.WRAPPED_ABOVE_AND_BELOW) {
			editorModel.pushEditOperations(selections, [
				{ range: startRange, text: beginInsertedCode },
				{ range: endRange, text: endInsertedCode }], undefined);
		} else if (markdownLineType === MarkdownLineType.EVERY_LINE) {
			const replacementTokens = getStartTextToReplace(markdownButtonType);
			const operations: IIdentifiedSingleEditOperation[] = [];
			// Create the edit operation to insert the text for every line
			for (let i = selection.startLineNumber; i <= selection.endLineNumber; i++) {
				// If this token is part of a group then see if the text for this line
				// starts with any of the tokens in that group
				const replacementText = replacementTokens.find(t => {
					const text = editorModel.getValueInRange({
						startColumn: 1,
						startLineNumber: i,
						endColumn: t.length + 1,
						endLineNumber: i
					});
					return text === t;
				});
				// If we have text to replace do that - otherwise just insert the text directly
				if (replacementText) {
					operations.push(EditOperation.replace(new Range(i, 1, i, replacementText.length + 1), beginInsertedCode));
				} else {
					operations.push(EditOperation.insert(new Position(i, 0), beginInsertedCode));
				}
			}
			editorModel.pushEditOperations(selections, operations, undefined);
		}
	}

	/**
	 * Gets the extended selected text (current selection + potential beginning + ending transformed text)
	 * @param selection Current selection in editor
	 * @param type Markdown Button Type
	 * @param lineType Markdown Line Type
	 * @param editorModel TextModel
	 */
	private getExtendedSelectedText(selection: Selection, type: MarkdownButtonType, lineType: MarkdownLineType, editorModel: TextModel): string {
		if (lineType === MarkdownLineType.BEGIN_AND_END_LINES) {
			return editorModel.getValueInRange({
				startColumn: selection.startColumn - getStartTextToInsert(type).length,
				startLineNumber: selection.startLineNumber,
				endColumn: selection.endColumn + getEndTextToInsert(type).length,
				endLineNumber: selection.endLineNumber
			});
		} else if (lineType === MarkdownLineType.WRAPPED_ABOVE_AND_BELOW) {
			return editorModel.getValueInRange({
				startColumn: 1,
				startLineNumber: selection.startLineNumber - 1,
				endColumn: getEndTextToInsert(type).length + 1,
				endLineNumber: selection.endLineNumber + 1
			});
		}
		return '';
	}

	/**
	 * Returns whether all lines start with the expected transformed text for actions that match the EVERY_LINE line type
	 * @param selection Current selection in editor
	 * @param type Markdown Button Type
	 * @param editorModel TextModel
	 */
	private everyLineMatchesBeginString(selection: Selection, type: MarkdownButtonType, editorModel: TextModel): boolean {
		for (let selectionLine = selection.startLineNumber; selectionLine <= selection.endLineNumber; selectionLine++) {
			if (!editorModel.getLineContent(selectionLine).startsWith(getStartTextToInsert(type))) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Create new IRange object with arbitrary offsets
	 * @param initialRange range object
	 * @param startColumnOffset
	 * @param startLineNumberOffset
	 * @param endColumnOffset
	 * @param endLineNumberOffset
	 */
	private getIRangeWithOffsets(initialRange: IRange, startColumnOffset = 0, startLineNumberOffset = 0, endColumnOffset = 0, endLineNumberOffset = 0): IRange {
		return {
			startColumn: initialRange.startColumn + startColumnOffset,
			startLineNumber: initialRange.startLineNumber + startLineNumberOffset,
			endColumn: initialRange.endColumn + endColumnOffset,
			endLineNumber: initialRange.endLineNumber + endLineNumberOffset
		};
	}
}

export enum MarkdownButtonType {
	BOLD,
	ITALIC,
	UNDERLINE,
	CODE,
	HIGHLIGHT,
	LINK,
	UNORDERED_LIST,
	ORDERED_LIST,
	IMAGE,
	HEADING1,
	HEADING2,
	HEADING3,
	PARAGRAPH
}

/**
 * The line types
 */
export enum MarkdownLineType {
	/**
	 * Applies to the beginning and end lines only of a selection
	 */
	BEGIN_AND_END_LINES,
	/**
	 * Applies to every line within the selection
	 */
	EVERY_LINE,
	/**
	 * Applies to the entire selection by wrapping it in new text above and below
	 */
	WRAPPED_ABOVE_AND_BELOW
}

/**
 * Groups of related types - these will be considered as the same when doing a transformation
 * so will replace each other instead of just prepending new text if the line already starts
 * with the text for another member of the group.
 */
const buttonTypeGroups = [
	[
		MarkdownButtonType.HEADING1,
		MarkdownButtonType.HEADING2,
		MarkdownButtonType.HEADING3,
		MarkdownButtonType.PARAGRAPH
	]
];

/**
 * Gets the list of strings that will be replaced if a selection starts
 * with the specified text
 * @param type The button type action being ran
 */
function getStartTextToReplace(type: MarkdownButtonType): string[] {
	for (const group of buttonTypeGroups) {
		const item = group.find(value => value === type);
		if (item) {
			return group.filter(item => item !== type).map(item => getStartTextToInsert(item));
		}
	}
	return [];
}

/**
 * Gets the text to insert at the beginning of the selection
 * @param type The button type action being ran
 */
function getStartTextToInsert(type: MarkdownButtonType): string {
	switch (type) {
		case MarkdownButtonType.BOLD:
			return '**';
		case MarkdownButtonType.ITALIC:
			return '_';
		case MarkdownButtonType.UNDERLINE:
			return '<u>';
		case MarkdownButtonType.CODE:
			return '```\n';
		case MarkdownButtonType.LINK:
			return '[';
		case MarkdownButtonType.UNORDERED_LIST:
			return '- ';
		case MarkdownButtonType.ORDERED_LIST:
			return '1. ';
		case MarkdownButtonType.IMAGE:
			return '![';
		case MarkdownButtonType.HIGHLIGHT:
			return '<mark>';
		case MarkdownButtonType.HEADING1:
			return '# ';
		case MarkdownButtonType.HEADING2:
			return '## ';
		case MarkdownButtonType.HEADING3:
			return '### ';
		default:
			return '';
	}
}

/**
 * Gets the text to insert at the end of the selection
 * @param type The button type action being ran
 */
function getEndTextToInsert(type: MarkdownButtonType): string {
	switch (type) {
		case MarkdownButtonType.BOLD:
			return '**';
		case MarkdownButtonType.ITALIC:
			return '_';
		case MarkdownButtonType.UNDERLINE:
			return '</u>';
		case MarkdownButtonType.CODE:
			return '\n```';
		case MarkdownButtonType.LINK:
		case MarkdownButtonType.IMAGE:
			return ']()';
		case MarkdownButtonType.HIGHLIGHT:
			return '</mark>';
		case MarkdownButtonType.UNORDERED_LIST:
		case MarkdownButtonType.ORDERED_LIST:
		case MarkdownButtonType.HEADING1:
		case MarkdownButtonType.HEADING2:
		case MarkdownButtonType.HEADING3:
		case MarkdownButtonType.PARAGRAPH:
		default:
			return '';
	}
}

/**
 * Gets the line type that a button type applies to
 * @param type The button type action being ran
 */
function getMarkdownLineType(type: MarkdownButtonType): MarkdownLineType {
	switch (type) {
		case MarkdownButtonType.CODE:
			return MarkdownLineType.WRAPPED_ABOVE_AND_BELOW;
		case MarkdownButtonType.UNORDERED_LIST:
		case MarkdownButtonType.ORDERED_LIST:
		case MarkdownButtonType.HEADING1:
		case MarkdownButtonType.HEADING2:
		case MarkdownButtonType.HEADING3:
		case MarkdownButtonType.PARAGRAPH:
			return MarkdownLineType.EVERY_LINE;
		default:
			return MarkdownLineType.BEGIN_AND_END_LINES;
	}
}


/**
 * Get offset from the end column for editor selection
 * For example, when inserting a link, we want to have the cursor be present in between the brackets
 * @param type
 * @param nothingSelected
 */
function getColumnOffsetForSelection(type: MarkdownButtonType, nothingSelected: boolean): number {
	if (nothingSelected) {
		return 0;
	}
	switch (type) {
		case MarkdownButtonType.LINK:
			return 2;
		case MarkdownButtonType.IMAGE:
			return 2;
		// -1 is considered as having no explicit offset, so do not do anything with selection
		default: return -1;
	}
}

export class TogglePreviewAction extends ToggleableAction {

	private static readonly previewShowLabel = localize('previewShowLabel', "Show Preview");
	private static readonly previewHideLabel = localize('previewHideLabel', "Hide Preview");
	private static readonly baseClass = 'codicon';
	private static readonly previewShowCssClass = 'split-toggle-on';
	private static readonly previewHideCssClass = 'split-toggle-off';
	private static readonly maskedIconClass = 'masked-icon';

	constructor(
		id: string, toggleTooltip: boolean, showPreview: boolean
	) {
		super(id, {
			baseClass: TogglePreviewAction.baseClass,
			toggleOffLabel: TogglePreviewAction.previewShowLabel,
			toggleOffClass: TogglePreviewAction.previewShowCssClass,
			toggleOnLabel: TogglePreviewAction.previewHideLabel,
			toggleOnClass: TogglePreviewAction.previewHideCssClass,
			maskedIconClass: TogglePreviewAction.maskedIconClass,
			shouldToggleTooltip: toggleTooltip,
			isOn: showPreview
		});
	}

	public get previewMode(): boolean {
		return this.state.isOn;
	}
	public set previewMode(value: boolean) {
		this.toggle(value);
	}
	public async run(context: any): Promise<boolean> {
		this.previewMode = !this.previewMode;
		context.cellModel.showPreview = this.previewMode;
		return true;
	}
}

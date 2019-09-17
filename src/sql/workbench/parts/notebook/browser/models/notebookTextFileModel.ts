/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range, IRange } from 'vs/editor/common/core/range';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';
import { FindMatch } from 'vs/editor/common/model';
import { NotebookContentChange, INotebookModel } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { NotebookChangeType } from 'sql/workbench/parts/notebook/common/models/contracts';

export class NotebookTextFileModel {
	// save active cell's line/column in editor model for the beginning of the source property
	private _sourceBeginRange: Range;
	// save active cell's line/column in editor model for the beginning of the output property
	private _outputBeginRange: Range;
	// save active cell guid
	private _activeCellGuid: string;

	constructor(private _eol: string) {
	}

	public get activeCellGuid(): string {
		return this._activeCellGuid;
	}

	public set activeCellGuid(guid: string) {
		if (this._activeCellGuid !== guid) {
			this._sourceBeginRange = undefined;
			this._outputBeginRange = undefined;
			this._activeCellGuid = guid;
		}
	}

	public transformAndApplyEditForSourceUpdate(contentChange: NotebookContentChange, textEditorModel: TextFileEditorModel | UntitledEditorModel): boolean {
		let cellGuidRange = this.getCellNodeByGuid(textEditorModel, contentChange.cells[0].cellGuid);

		// convert the range to leverage offsets in the json
		if (contentChange && contentChange.modelContentChangedEvent && areRangePropertiesPopulated(cellGuidRange)) {
			contentChange.modelContentChangedEvent.changes.forEach(change => {
				let convertedRange: IRange = {
					startLineNumber: change.range.startLineNumber + cellGuidRange.startLineNumber - 1,
					endLineNumber: change.range.endLineNumber + cellGuidRange.startLineNumber - 1,
					startColumn: change.range.startColumn + cellGuidRange.startColumn,
					endColumn: change.range.endColumn + cellGuidRange.startColumn
				};
				// Need to subtract one because we're going from 1-based to 0-based
				let startSpaces: string = ' '.repeat(cellGuidRange.startColumn - 1);
				// The text here transforms a string from 'This is a string\n this is another string' to:
				//     This is a string
				//     this is another string
				textEditorModel.textEditorModel.applyEdits([{
					range: new Range(convertedRange.startLineNumber, convertedRange.startColumn, convertedRange.endLineNumber, convertedRange.endColumn),
					text: change.text.split(this._eol).join('\\n\",'.concat(this._eol).concat(startSpaces).concat('\"'))
				}]);
			});
		} else {
			return false;
		}
		return true;
	}

	public transformAndApplyEditForOutputUpdate(contentChange: NotebookContentChange, textEditorModel: TextFileEditorModel | UntitledEditorModel): boolean {
		if (Array.isArray(contentChange.cells[0].outputs) && contentChange.cells[0].outputs.length > 0) {
			let newOutput = JSON.stringify(contentChange.cells[0].outputs[contentChange.cells[0].outputs.length - 1], undefined, '    ');
			if (contentChange.cells[0].outputs.length > 1) {
				newOutput = ', '.concat(newOutput);
			} else {
				newOutput = '\n'.concat(newOutput).concat('\n');
			}
			let range = this.getEndOfOutputs(textEditorModel, contentChange.cells[0].cellGuid);
			if (range) {
				textEditorModel.textEditorModel.applyEdits([{
					range: new Range(range.startLineNumber, range.startColumn, range.startLineNumber, range.startColumn),
					text: newOutput
				}]);
			}
		} else {
			return false;
		}
		return true;
	}

	public transformAndApplyEditForCellUpdated(contentChange: NotebookContentChange, textEditorModel: TextFileEditorModel | UntitledEditorModel): boolean {
		let executionCountMatch = this.getExecutionCountRange(textEditorModel, contentChange.cells[0].cellGuid);
		if (executionCountMatch && executionCountMatch.range) {
			// Execution count can be between 0 and n characters long
			let beginExecutionCountColumn = executionCountMatch.range.endColumn;
			let endExecutionCountColumn = beginExecutionCountColumn + 1;
			let lineContent = textEditorModel.textEditorModel.getLineContent(executionCountMatch.range.endLineNumber);
			while (lineContent[endExecutionCountColumn - 1]) {
				endExecutionCountColumn++;
			}
			if (contentChange.cells[0].executionCount) {
				textEditorModel.textEditorModel.applyEdits([{
					range: new Range(executionCountMatch.range.startLineNumber, beginExecutionCountColumn, executionCountMatch.range.endLineNumber, endExecutionCountColumn),
					text: contentChange.cells[0].executionCount.toString()
				}]);
			} else {
				// This is a special case when cells are canceled; there will be no execution count included
				return true;
			}
		} else {
			return false;
		}
		return true;
	}

	public transformAndApplyEditForClearOutput(contentChange: NotebookContentChange, textEditorModel: TextFileEditorModel | UntitledEditorModel): boolean {
		if (!textEditorModel || !contentChange || !contentChange.cells || !contentChange.cells[0] || !contentChange.cells[0].cellGuid) {
			return false;
		}
		if (!this.getOutputNodeByGuid(textEditorModel, contentChange.cells[0].cellGuid)) {
			this.updateOutputBeginRange(textEditorModel, contentChange.cells[0].cellGuid);
		}
		let outputEndRange = this.getEndOfOutputs(textEditorModel, contentChange.cells[0].cellGuid);
		let outputStartRange = this.getOutputNodeByGuid(textEditorModel, contentChange.cells[0].cellGuid);
		if (outputStartRange && outputEndRange) {
			textEditorModel.textEditorModel.applyEdits([{
				range: new Range(outputStartRange.startLineNumber, outputStartRange.endColumn, outputEndRange.endLineNumber, outputEndRange.endColumn),
				text: ''
			}]);
			return true;
		}
		return false;
	}

	public replaceEntireTextEditorModel(notebookModel: INotebookModel, type: NotebookChangeType, textEditorModel: TextFileEditorModel | UntitledEditorModel) {
		let content = JSON.stringify(notebookModel.toJSON(type), undefined, '    ');
		let model = textEditorModel.textEditorModel;
		let endLine = model.getLineCount();
		let endCol = model.getLineMaxColumn(endLine);
		textEditorModel.textEditorModel.applyEdits([{
			range: new Range(1, 1, endLine, endCol),
			text: content
		}]);
	}

	// Find the beginning of a cell's source in the text editor model
	private updateSourceBeginRange(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string): void {
		if (!cellGuid) {
			return;
		}
		this._sourceBeginRange = undefined;

		let cellGuidMatches = findOrSetCellGuidMatch(textEditorModel, cellGuid);
		if (cellGuidMatches && cellGuidMatches.length > 0) {
			let sourceBefore = textEditorModel.textEditorModel.findPreviousMatch('"source": [', { lineNumber: cellGuidMatches[0].range.startLineNumber, column: cellGuidMatches[0].range.startColumn }, false, true, undefined, true);
			if (!sourceBefore || !sourceBefore.range) {
				return;
			}
			let firstQuoteOfSource = textEditorModel.textEditorModel.findNextMatch('"', { lineNumber: sourceBefore.range.startLineNumber, column: sourceBefore.range.endColumn }, false, true, undefined, true);
			this._sourceBeginRange = firstQuoteOfSource.range;
		} else {
			return;
		}
	}

	// Find the beginning of a cell's outputs in the text editor model
	private updateOutputBeginRange(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string): void {
		if (!cellGuid) {
			return undefined;
		}
		this._outputBeginRange = undefined;

		let cellGuidMatches = findOrSetCellGuidMatch(textEditorModel, cellGuid);
		if (cellGuidMatches && cellGuidMatches.length > 0) {
			let outputsBegin = textEditorModel.textEditorModel.findNextMatch('"outputs": [', { lineNumber: cellGuidMatches[0].range.endLineNumber, column: cellGuidMatches[0].range.endColumn }, false, true, undefined, true);
			if (!outputsBegin || !outputsBegin.range) {
				return undefined;
			}
			this._outputBeginRange = outputsBegin.range;
		} else {
			return undefined;
		}
	}

	// Find the end of a cell's outputs in the text editor model
	// This will be used as a starting point for any future outputs
	private getEndOfOutputs(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string) {
		let outputsBegin;
		if (this._activeCellGuid === cellGuid) {
			outputsBegin = this._outputBeginRange;
		}
		if (!outputsBegin || !textEditorModel.textEditorModel.getLineContent(outputsBegin.startLineNumber).trim().includes('output')) {
			this.updateOutputBeginRange(textEditorModel, cellGuid);
			outputsBegin = this._outputBeginRange;
			if (!outputsBegin) {
				return undefined;
			}
		}
		let outputsEnd = textEditorModel.textEditorModel.matchBracket({ column: outputsBegin.endColumn - 1, lineNumber: outputsBegin.endLineNumber });
		if (!outputsEnd || outputsEnd.length < 2) {
			return undefined;
		}
		// single line output [i.e. no outputs exist for a cell]
		if (outputsBegin.endLineNumber === outputsEnd[1].startLineNumber) {
			// Adding 1 to startColumn to replace text starting one character after '['
			return {
				startColumn: outputsEnd[0].startColumn + 1,
				startLineNumber: outputsEnd[0].startLineNumber,
				endColumn: outputsEnd[0].endColumn,
				endLineNumber: outputsEnd[0].endLineNumber
			};
		} else {
			// Last 2 lines in multi-line output will look like the following:
			// "                }"
			// "            ],"
			if (textEditorModel.textEditorModel.getLineContent(outputsEnd[1].endLineNumber - 1).trim() === '}') {
				return {
					startColumn: textEditorModel.textEditorModel.getLineFirstNonWhitespaceColumn(outputsEnd[1].endLineNumber - 1) + 1,
					startLineNumber: outputsEnd[1].endLineNumber - 1,
					endColumn: outputsEnd[1].endColumn - 1,
					endLineNumber: outputsEnd[1].endLineNumber
				};
			}
			return undefined;
		}
	}

	// Determine what text needs to be replaced when execution counts are updated
	private getExecutionCountRange(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string) {
		let endOutputRange = this.getEndOfOutputs(textEditorModel, cellGuid);
		if (endOutputRange && endOutputRange.endLineNumber) {
			return textEditorModel.textEditorModel.findNextMatch('"execution_count": ', { lineNumber: endOutputRange.endLineNumber, column: endOutputRange.endColumn }, false, true, undefined, true);
		}
		return undefined;
	}

	// Find a cell's location, given its cellGuid
	// If it doesn't exist (e.g. it's not the active cell), attempt to find it
	private getCellNodeByGuid(textEditorModel: TextFileEditorModel | UntitledEditorModel, guid: string) {
		if (this._activeCellGuid !== guid || !this._sourceBeginRange) {
			this.updateSourceBeginRange(textEditorModel, guid);
		}
		return this._sourceBeginRange;
	}

	private getOutputNodeByGuid(textEditorModel: TextFileEditorModel | UntitledEditorModel, guid: string) {
		if (this._activeCellGuid !== guid) {
			this.updateOutputBeginRange(textEditorModel, guid);
		}
		return this._outputBeginRange;
	}

}

function areRangePropertiesPopulated(range: Range) {
	return range && range.startLineNumber && range.startColumn && range.endLineNumber && range.endColumn;
}

function findOrSetCellGuidMatch(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string): FindMatch[] {
	if (!textEditorModel || !cellGuid) {
		return undefined;
	}
	return textEditorModel.textEditorModel.findMatches(cellGuid, false, false, true, undefined, true);
}

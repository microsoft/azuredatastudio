/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range, IRange } from 'vs/editor/common/core/range';
import { FindMatch } from 'vs/editor/common/model';
import { NotebookContentChange, INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { repeat } from 'vs/base/common/strings';
import { ITextEditorModel } from 'vs/workbench/common/editor';

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

	public transformAndApplyEditForSourceUpdate(contentChange: NotebookContentChange, textEditorModel: ITextEditorModel): boolean {
		let cellGuidRange = this.getCellNodeByGuid(textEditorModel, contentChange.cells[0].cellGuid);

		// convert the range to leverage offsets in the json
		if (contentChange && contentChange.modelContentChangedEvent && areRangePropertiesPopulated(cellGuidRange)) {
			contentChange.modelContentChangedEvent.changes.forEach(change => {
				// When writing to JSON we need to escape double quotes and backslashes
				let textEscapedQuotesAndBackslashes = change.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

				let startLineNumber = change.range.startLineNumber + cellGuidRange.startLineNumber - 1;
				let endLineNumber = change.range.endLineNumber + cellGuidRange.startLineNumber - 1;
				let startLineText = textEditorModel.textEditorModel.getLineContent(startLineNumber);
				let endLineText = textEditorModel.textEditorModel.getLineContent(endLineNumber);

				/* This gets the text on the start and end lines of the range where we'll be inserting text. We need to convert the escaped strings to unescaped strings.
					Example:

					Previous state
					EDITOR:
					""""

					TEXTEDITORMODEL:
					'        "\"\"\"\""'

					Now, user wants to insert text after the 4 double quotes, like so:
					EDITOR:
					""""sample text

					TEXTEDITORMODEL (result):
					'        "\"\"\"\"sample text"'

					Notice that we don't have a 1:1 mapping for characters from the editor to the text editor model, because the double quotes need to be escaped
					(the same is true for backslashes).

					Therefore, we need to determine (at both the start and end lines) the "real" start and end columns in the text editor model by counting escaped characters.

					We do this by doing the following:
					- Start with (escaped) text in the text editor model
					- Unescape this text
					- Get a substring of that text from the column in JSON until the change's startColumn (starting from the first " in the text editor model)
					- Escape this substring
					- Leverage the substring's length to calculate the "real" start/end columns
				 */
				let unescapedStartSubstring = startLineText.replace(/\\"/g, '"').replace(/\\\\/g, '\\').substr(cellGuidRange.startColumn, change.range.startColumn - 1);
				let unescapedEndSubstring = endLineText.replace(/\\"/g, '"').replace(/\\\\/g, '\\').substr(cellGuidRange.startColumn, change.range.endColumn - 1);

				// now we have the portion before the text to be inserted for both the start and end lines
				// so next step is to escape " and \

				let escapedStartSubstring = unescapedStartSubstring.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
				let escapedEndSubstring = unescapedEndSubstring.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

				let computedStartColumn = escapedStartSubstring.length + cellGuidRange.startColumn + 1;
				let computedEndColumn = escapedEndSubstring.length + cellGuidRange.startColumn + 1;

				let convertedRange: IRange = {
					startLineNumber: startLineNumber,
					endLineNumber: endLineNumber,
					startColumn: computedStartColumn,
					endColumn: computedEndColumn
				};
				// Need to subtract one because we're going from 1-based to 0-based
				let startSpaces: string = repeat(' ', cellGuidRange.startColumn - 1);
				// The text here transforms a string from 'This is a string\n this is another string' to:
				//     This is a string
				//     this is another string
				textEditorModel.textEditorModel.applyEdits([{
					range: new Range(convertedRange.startLineNumber, convertedRange.startColumn, convertedRange.endLineNumber, convertedRange.endColumn),
					text: textEscapedQuotesAndBackslashes.split(/[\r\n]+/gm).join('\\n\",'.concat(this._eol).concat(startSpaces).concat('\"'))
				}]);
			});
			return true;
		}
		return false;
	}

	public transformAndApplyEditForOutputUpdate(contentChange: NotebookContentChange, textEditorModel: ITextEditorModel): boolean {
		if (Array.isArray(contentChange.cells[0].outputs) && contentChange.cells[0].outputs.length > 0) {
			let newOutput = JSON.stringify(contentChange.cells[0].outputs[contentChange.cells[0].outputs.length - 1], undefined, '    ');
			if (contentChange.cells[0].outputs.length > 1) {
				newOutput = ', '.concat(newOutput);
			} else {
				newOutput = '\n'.concat(newOutput).concat('\n');
			}

			// Execution count will always be after the end of the outputs in JSON. This is a sanity mechanism.
			let executionCountMatch = this.getExecutionCountRange(textEditorModel, contentChange.cells[0].cellGuid);
			if (!executionCountMatch || !executionCountMatch.range) {
				return false;
			}

			let endOutputsRange = this.getEndOfOutputs(textEditorModel, contentChange.cells[0].cellGuid);
			if (endOutputsRange && endOutputsRange.startLineNumber < executionCountMatch.range.startLineNumber) {
				textEditorModel.textEditorModel.applyEdits([{
					range: new Range(endOutputsRange.startLineNumber, endOutputsRange.startColumn, endOutputsRange.startLineNumber, endOutputsRange.startColumn),
					text: newOutput
				}]);
				return true;
			}
		}
		return false;
	}

	public transformAndApplyEditForCellUpdated(contentChange: NotebookContentChange, textEditorModel: ITextEditorModel): boolean {
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

	public transformAndApplyEditForClearOutput(contentChange: NotebookContentChange, textEditorModel: ITextEditorModel): boolean {
		if (!textEditorModel || !contentChange || !contentChange.cells || !contentChange.cells[0] || !contentChange.cells[0].cellGuid) {
			return false;
		}
		this.updateOutputBeginRange(textEditorModel, contentChange.cells[0].cellGuid);
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

	public replaceEntireTextEditorModel(notebookModel: INotebookModel, type: NotebookChangeType, textEditorModel: ITextEditorModel) {
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
	private updateSourceBeginRange(textEditorModel: ITextEditorModel, cellGuid: string): void {
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
	private updateOutputBeginRange(textEditorModel: ITextEditorModel, cellGuid: string): void {
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
	private getEndOfOutputs(textEditorModel: ITextEditorModel, cellGuid: string) {
		let outputsBegin;
		if (this._activeCellGuid === cellGuid) {
			outputsBegin = this._outputBeginRange;
		}
		if (!outputsBegin || !(textEditorModel.textEditorModel.getLineContent(outputsBegin.startLineNumber).trim().indexOf('output') > -1)) {
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
	private getExecutionCountRange(textEditorModel: ITextEditorModel, cellGuid: string) {
		let endOutputRange = this.getEndOfOutputs(textEditorModel, cellGuid);
		if (endOutputRange && endOutputRange.endLineNumber) {
			return textEditorModel.textEditorModel.findNextMatch('"execution_count": ', { lineNumber: endOutputRange.endLineNumber, column: endOutputRange.endColumn }, false, true, undefined, true);
		}
		return undefined;
	}

	// Find a cell's location, given its cellGuid
	// If it doesn't exist (e.g. it's not the active cell), attempt to find it
	private getCellNodeByGuid(textEditorModel: ITextEditorModel, guid: string) {
		if (this._activeCellGuid !== guid || !this._sourceBeginRange) {
			this.updateSourceBeginRange(textEditorModel, guid);
		}
		return this._sourceBeginRange;
	}

	private getOutputNodeByGuid(textEditorModel: ITextEditorModel, guid: string) {
		if (this._activeCellGuid !== guid) {
			this.updateOutputBeginRange(textEditorModel, guid);
		}
		return this._outputBeginRange;
	}

}

function areRangePropertiesPopulated(range: Range) {
	return range && range.startLineNumber !== 0 && range.startColumn !== 0 && range.endLineNumber !== 0 && range.endColumn !== 0;
}

function findOrSetCellGuidMatch(textEditorModel: ITextEditorModel, cellGuid: string): FindMatch[] {
	if (!textEditorModel || !cellGuid) {
		return undefined;
	}
	return textEditorModel.textEditorModel.findMatches(cellGuid, false, false, true, undefined, true);
}

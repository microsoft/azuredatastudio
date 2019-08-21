/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range, IRange } from 'vs/editor/common/core/range';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';
import { FindMatch } from 'vs/editor/common/model';
import { NotebookContentChange, INotebookModel } from 'sql/workbench/parts/notebook/common/models/modelInterfaces';
import { NotebookChangeType } from 'sql/workbench/parts/notebook/common/models/contracts';

export class NotebookTextFileModel {
	private sourceMap: Map<string, Range>;
	private outputBeginMap: Map<string, Range>;
	private activeCellGuid: string;
	private cellGuidMatches: FindMatch[];

	constructor() {
		this.sourceMap = new Map<string, Range>();
		this.outputBeginMap = new Map<string, Range>();
	}

	public updateSourceMap(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string): void {
		if (!cellGuid) {
			return;
		}
		this.sourceMap.clear();

		if (this.findOrSetCellGuidMatch(textEditorModel, cellGuid)) {
			let sourceBefore = textEditorModel.textEditorModel.findPreviousMatch('"source": [', { lineNumber: this.cellGuidMatches[0].range.startLineNumber, column: this.cellGuidMatches[0].range.startColumn }, false, true, undefined, true);
			if (!sourceBefore || !sourceBefore.range) {
				return;
			}
			let firstQuoteOfSource = textEditorModel.textEditorModel.findNextMatch('"', { lineNumber: sourceBefore.range.startLineNumber, column: sourceBefore.range.endColumn }, false, true, undefined, true);
			this.sourceMap.set(cellGuid, firstQuoteOfSource.range);
		} else {
			return;
		}
	}

	public updateOutputBeginMap(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string): void {
		if (!cellGuid) {
			return undefined;
		}
		this.outputBeginMap.clear();
		if (this.findOrSetCellGuidMatch(textEditorModel, cellGuid)) {
			let outputsBegin = textEditorModel.textEditorModel.findNextMatch('"outputs": [', { lineNumber: this.cellGuidMatches[0].range.endLineNumber, column: this.cellGuidMatches[0].range.endColumn }, false, true, undefined, true);
			if (!outputsBegin || !outputsBegin.range) {
				return undefined;
			}
			this.outputBeginMap.set(cellGuid, outputsBegin.range);
		} else {
			return undefined;
		}
	}

	public getEndOfOutputs(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string) {
		let outputsBegin = this.outputBeginMap.get(cellGuid);
		if (!outputsBegin || !textEditorModel.textEditorModel.getLineContent(outputsBegin.startLineNumber).trim().includes('output')) {
			this.updateOutputBeginMap(textEditorModel, cellGuid);
			outputsBegin = this.outputBeginMap.get(cellGuid);
			if (!outputsBegin) {
				return undefined;
			}
		}
		let outputsEnd = textEditorModel.textEditorModel.matchBracket({ column: outputsBegin.endColumn - 1, lineNumber: outputsBegin.endLineNumber });
		if (!outputsEnd || outputsEnd.length < 2) {
			return undefined;
		}
		// single line output
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

	public getExecutionCountRange(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string) {
		let endOutputRange = this.getEndOfOutputs(textEditorModel, cellGuid);
		if (endOutputRange && endOutputRange.endLineNumber) {
			return textEditorModel.textEditorModel.findNextMatch('"execution_count": ', { lineNumber: endOutputRange.endLineNumber, column: endOutputRange.endColumn }, false, true, undefined, true);
		}
		return undefined;
	}

	public getCellNodeByGuid(textEditorModel: TextFileEditorModel | UntitledEditorModel, guid: string) {
		if (this.sourceMap.get(guid)) {
			return this.sourceMap.get(guid);
		} else {
			this.updateSourceMap(textEditorModel, guid);
			return this.sourceMap.get(guid);
		}
	}

	public getOutputNodeByGuid(guid: string) {
		return this.outputBeginMap.get(guid);
	}

	public get ActiveCellGuid(): string {
		return this.activeCellGuid;
	}

	public set ActiveCellGuid(guid: string) {
		if (this.activeCellGuid !== guid) {
			this.sourceMap.clear();
			this.outputBeginMap.clear();
			this.cellGuidMatches = undefined;
			this.activeCellGuid = guid;
		}
	}

	public transformAndApplyEditForSourceUpdate(contentChange: NotebookContentChange, textEditorModel: TextFileEditorModel | UntitledEditorModel): boolean {
		let cellGuidRange = this.getCellNodeByGuid(textEditorModel, contentChange.cells[0].cellGuid);

		// convert the range to leverage offsets in the json
		if (contentChange && contentChange.modelContentChangedEvent && this.areRangePropertiesAllSet(cellGuidRange)) {
			contentChange.modelContentChangedEvent.changes.forEach(change => {
				let convertedRange: IRange = {
					startLineNumber: change.range.startLineNumber + cellGuidRange.startLineNumber - 1,
					endLineNumber: change.range.endLineNumber + cellGuidRange.startLineNumber - 1,
					startColumn: change.range.startColumn + cellGuidRange.startColumn,
					endColumn: change.range.endColumn + cellGuidRange.startColumn
				};
				// Need to subtract one because we're going from 1-based to 0-based
				let startSpaces: string = ' '.repeat(cellGuidRange.startColumn - 1);
				textEditorModel.textEditorModel.applyEdits([{
					range: new Range(convertedRange.startLineNumber, convertedRange.startColumn, convertedRange.endLineNumber, convertedRange.endColumn),
					text: change.text.split('\n').join('\\n\",\n'.concat(startSpaces).concat('\"'))
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
			while (textEditorModel.textEditorModel.getLineContent(executionCountMatch.range.endLineNumber)[endExecutionCountColumn + 1]) {
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
		let outputEndRange = this.getEndOfOutputs(textEditorModel, contentChange.cells[0].cellGuid);
		let outputStartRange = this.getOutputNodeByGuid(contentChange.cells[0].cellGuid);
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

	private areRangePropertiesAllSet(range: Range) {
		return range.startLineNumber && range.startColumn && range.endLineNumber && range.endColumn;
	}

	private findOrSetCellGuidMatch(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string): boolean {
		if (!this.cellGuidMatches || this.cellGuidMatches.length < 1 || !textEditorModel.textEditorModel.getLineContent(this.cellGuidMatches[0].range.endLineNumber).trim().includes(cellGuid)) {
			this.cellGuidMatches = textEditorModel.textEditorModel.findMatches(cellGuid, false, false, true, undefined, true);
			if (!this.cellGuidMatches || this.cellGuidMatches.length < 1) {
				return false;
			}
		}
		return true;
	}
}

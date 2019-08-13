/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range, IRange } from 'vs/editor/common/core/range';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';

export class NotebookTextFileModel {
	private sourceMap: Map<string, Range>;
	private outputBeginMap: Map<string, Range>;
	private activeCellGuid: string;

	constructor() {
		this.sourceMap = new Map<string, Range>();
		this.outputBeginMap = new Map<string, Range>();
	}

	public updateSourceMap(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string): void {
		if (!cellGuid) {
			return;
		}
		this.sourceMap.clear();
		let cellGuidMatch = textEditorModel.textEditorModel.findMatches(cellGuid, false, false, true, undefined, true);
		if (!cellGuidMatch || cellGuidMatch.length < 1) {
			return;
		}
		let sourceBefore = textEditorModel.textEditorModel.findPreviousMatch('"source": [', { lineNumber: cellGuidMatch[0].range.startLineNumber, column: cellGuidMatch[0].range.startColumn }, false, true, undefined, true);
		if (!sourceBefore || !sourceBefore.range) {
			return;
		}
		let firstQuoteOfSource = textEditorModel.textEditorModel.findNextMatch('"', { lineNumber: sourceBefore.range.startLineNumber, column: sourceBefore.range.endColumn }, false, true, undefined, true);
		this.sourceMap.set(cellGuid, firstQuoteOfSource.range);
	}

	public updateOutputBeginMap(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string): void {
		if (!cellGuid) {
			return undefined;
		}
		this.outputBeginMap.clear();
		let cellGuidMatch = textEditorModel.textEditorModel.findMatches(cellGuid, false, false, true, undefined, true);
		if (!cellGuidMatch || cellGuidMatch.length < 1) {
			return undefined;
		}
		let outputsBegin = textEditorModel.textEditorModel.findNextMatch('"outputs": [', { lineNumber: cellGuidMatch[0].range.endLineNumber, column: cellGuidMatch[0].range.endColumn }, false, true, undefined, true);
		if (!outputsBegin || !outputsBegin.range) {
			return undefined;
		}

		this.outputBeginMap.set(cellGuid, outputsBegin.range);
	}

	public getEndOfOutputs(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string) {
		let outputsBegin = this.outputBeginMap.get(cellGuid);
		if (!outputsBegin) {
			return undefined;
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
			// Last 2 lines in multi-line output will look like the following.
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

	public getCellNodeByGuid(guid: string) {
		return this.sourceMap.get(guid);
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
			this.activeCellGuid = guid;
		}
	}
}

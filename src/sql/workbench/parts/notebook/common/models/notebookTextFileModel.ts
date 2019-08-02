/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range, IRange } from 'vs/editor/common/core/range';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';

export class NotebookTextFileModel {
	private sourceMap: Map<string, Range>;

	constructor() {
		this.sourceMap = new Map<string, Range>();
	}

	public updateSourceMap(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string) {
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

	public getNextOutputRange(textEditorModel: TextFileEditorModel | UntitledEditorModel, cellGuid: string): IRange {
		if (!cellGuid) {
			return undefined;
		}
		let cellGuidMatch = textEditorModel.textEditorModel.findMatches(cellGuid, false, false, true, undefined, true);
		if (!cellGuidMatch || cellGuidMatch.length < 1) {
			return undefined;
		}
		let outputsBegin = textEditorModel.textEditorModel.findNextMatch('"outputs": [', { lineNumber: cellGuidMatch[0].range.endLineNumber, column: cellGuidMatch[0].range.endColumn }, false, true, undefined, true);
		if (!outputsBegin || !outputsBegin.range) {
			return undefined;
		}
		if (textEditorModel.textEditorModel.getLineContent(outputsBegin.range.startLineNumber).trim() === '"outputs": [],') {
			return {
				startColumn: outputsBegin.range.endColumn,
				startLineNumber: outputsBegin.range.endLineNumber,
				endColumn: outputsBegin.range.endColumn,
				endLineNumber: outputsBegin.range.endLineNumber
			};
		}
		let isMultiLineOutput = false;
		let executionCountAfter = textEditorModel.textEditorModel.findNextMatch('"execution_count": ', { lineNumber: outputsBegin.range.endLineNumber, column: outputsBegin.range.endColumn }, false, true, undefined, true);
		let hypotheticalLastOutputCurlyBraceLineNumber;

		while (!isMultiLineOutput) {
			// Last 2 lines in multi-line output will look like the following. Execution count is directly after.
			// "                }"
			// "            ],"
			// "            "execution_count": 1"
			let hypotheticalLastOutputCurlyBraceLineNumber = executionCountAfter.range.startLineNumber - 2;
			isMultiLineOutput = textEditorModel.textEditorModel.getLineContent(hypotheticalLastOutputCurlyBraceLineNumber).trim() === '}';

			executionCountAfter = textEditorModel.textEditorModel.findNextMatch('"execution_count": ', { lineNumber: executionCountAfter.range.endLineNumber, column: executionCountAfter.range.endColumn }, false, true, undefined, true);
			if (!executionCountAfter || !executionCountAfter.range) {
				return undefined;
			}
		}

		// Add 1 to account for the '}'
		return {
			startColumn: textEditorModel.textEditorModel.getLineFirstNonWhitespaceColumn(hypotheticalLastOutputCurlyBraceLineNumber) + 1,
			startLineNumber: hypotheticalLastOutputCurlyBraceLineNumber,
			endColumn: undefined,
			endLineNumber: undefined
		};
	}

	public getCellNodeByGuid(guid: string) {
		return this.sourceMap.get(guid);
	}
}

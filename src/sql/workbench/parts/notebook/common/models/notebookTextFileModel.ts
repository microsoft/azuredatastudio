/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range, IRange } from 'vs/editor/common/core/range';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';

// import * as jsonc from 'jsonc-parser';

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
		let matches = textEditorModel.textEditorModel.findMatches(cellGuid, false, false, true, undefined, true);
		if (!matches || matches.length < 1) {
			return;
		}
		let sourceBefore = textEditorModel.textEditorModel.findPreviousMatch('"source": [', { lineNumber: matches[0].range.startLineNumber, column: matches[0].range.startColumn }, false, true, undefined, true);
		let firstQuoteOfSource = textEditorModel.textEditorModel.findNextMatch('"', { lineNumber: sourceBefore.range.startLineNumber, column: sourceBefore.range.endColumn }, false, true, undefined, true);
		this.sourceMap.set(cellGuid, firstQuoteOfSource.range);
	}

	public getCellNodeByGuid(guid: string) {
		return this.sourceMap.get(guid);
	}
}

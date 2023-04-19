/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { ITextModel } from 'vs/editor/common/model';
import { computeIndentLevel } from 'vs/editor/common/model/utils';
import { FoldingMarkers } from 'vs/editor/common/languages/languageConfiguration';
import { ILanguageConfigurationService } from 'vs/editor/common/languages/languageConfigurationRegistry';
import { FoldingRegions, MAX_LINE_NUMBER } from 'vs/editor/contrib/folding/browser/foldingRanges';
import { RangeProvider } from './folding';

const MAX_FOLDING_REGIONS_FOR_INDENT_DEFAULT = 5000;

export const ID_INDENT_PROVIDER = 'indent';

export class IndentRangeProvider implements RangeProvider {
	readonly id = ID_INDENT_PROVIDER;

	constructor(
		private readonly editorModel: ITextModel,
		private readonly languageConfigurationService: ILanguageConfigurationService,
		private readonly maxFoldingRegions: number
	) { }

	dispose() { }

	compute(cancelationToken: CancellationToken, notifyTooManyRegions: (maxRegions: number) => void): Promise<FoldingRegions> {
		let foldingRules = this.languageConfigurationService.getLanguageConfiguration(this.editorModel.getLanguageId()).foldingRules;
		let offSide = foldingRules && !!foldingRules.offSide;
		let markers = foldingRules && foldingRules.markers;
		return Promise.resolve(computeRanges(this.editorModel, offSide, markers, this.maxFoldingRegions, notifyTooManyRegions));
	}
}

// public only for testing
export class RangesCollector {
	private readonly _startIndexes: number[];
	private readonly _endIndexes: number[];
	private readonly _indentOccurrences: number[];
	private _length: number;
	private readonly _foldingRangesLimit: number;

	constructor(foldingRangesLimit: number, private readonly _notifyTooManyRegions?: (maxRegions: number) => void) {
		this._startIndexes = [];
		this._endIndexes = [];
		this._indentOccurrences = [];
		this._length = 0;
		this._foldingRangesLimit = foldingRangesLimit;
	}

	public insertFirst(startLineNumber: number, endLineNumber: number, indent: number) {
		if (startLineNumber > MAX_LINE_NUMBER || endLineNumber > MAX_LINE_NUMBER) {
			return;
		}
		let index = this._length;
		this._startIndexes[index] = startLineNumber;
		this._endIndexes[index] = endLineNumber;
		this._length++;
		if (indent < 1000) {
			this._indentOccurrences[indent] = (this._indentOccurrences[indent] || 0) + 1;
		}
	}

	public toIndentRanges(model: ITextModel) {
		if (this._length <= this._foldingRangesLimit) {
			// reverse and create arrays of the exact length
			let startIndexes = new Uint32Array(this._length);
			let endIndexes = new Uint32Array(this._length);
			for (let i = this._length - 1, k = 0; i >= 0; i--, k++) {
				startIndexes[k] = this._startIndexes[i];
				endIndexes[k] = this._endIndexes[i];
			}
			return new FoldingRegions(startIndexes, endIndexes);
		} else {
			if (this._notifyTooManyRegions) {
				this._notifyTooManyRegions(this._foldingRangesLimit);
			}
			let entries = 0;
			let maxIndent = this._indentOccurrences.length;
			for (let i = 0; i < this._indentOccurrences.length; i++) {
				let n = this._indentOccurrences[i];
				if (n) {
					if (n + entries > this._foldingRangesLimit) {
						maxIndent = i;
						break;
					}
					entries += n;
				}
			}
			const tabSize = model.getOptions().tabSize;
			// reverse and create arrays of the exact length
			let startIndexes = new Uint32Array(this._foldingRangesLimit);
			let endIndexes = new Uint32Array(this._foldingRangesLimit);
			for (let i = this._length - 1, k = 0; i >= 0; i--) {
				let startIndex = this._startIndexes[i];
				let lineContent = model.getLineContent(startIndex);
				let indent = computeIndentLevel(lineContent, tabSize);
				if (indent < maxIndent || (indent === maxIndent && entries++ < this._foldingRangesLimit)) {
					startIndexes[k] = startIndex;
					endIndexes[k] = this._endIndexes[i];
					k++;
				}
			}
			return new FoldingRegions(startIndexes, endIndexes);
		}

	}
}


interface PreviousRegion {
	indent: number; // indent or -2 if a marker
	endAbove: number; // end line number for the region above
	line: number; // start line of the region. Only used for marker regions.
}

export function computeRanges(model: ITextModel, offSide: boolean, markers?: FoldingMarkers, foldingRangesLimit?: number, notifyTooManyRegions?: (maxRegions: number) => void): FoldingRegions {
	const tabSize = model.getOptions().tabSize;
	foldingRangesLimit = foldingRangesLimit ?? MAX_FOLDING_REGIONS_FOR_INDENT_DEFAULT;
	let result = new RangesCollector(foldingRangesLimit, notifyTooManyRegions);

	let pattern: RegExp | undefined = undefined;
	if (markers) {
		pattern = new RegExp(`(${markers.start.source})|(?:${markers.end.source})`);
	}

	let previousRegions: PreviousRegion[] = [];
	let line = model.getLineCount() + 1;
	previousRegions.push({ indent: -1, endAbove: line, line }); // sentinel, to make sure there's at least one entry

	for (let line = model.getLineCount(); line > 0; line--) {
		let lineContent = model.getLineContent(line);
		let indent = computeIndentLevel(lineContent, tabSize);
		let previous = previousRegions[previousRegions.length - 1];
		if (indent === -1) {
			if (offSide) {
				// for offSide languages, empty lines are associated to the previous block
				// note: the next block is already written to the results, so this only
				// impacts the end position of the block before
				previous.endAbove = line;
			}
			continue; // only whitespace
		}
		let m;
		if (pattern && (m = lineContent.match(pattern))) {
			// folding pattern match
			if (m[1]) { // start pattern match
				// discard all regions until the folding pattern
				let i = previousRegions.length - 1;
				while (i > 0 && previousRegions[i].indent !== -2) {
					i--;
				}
				if (i > 0) {
					previousRegions.length = i + 1;
					previous = previousRegions[i];

					// new folding range from pattern, includes the end line
					result.insertFirst(line, previous.line, indent);
					previous.line = line;
					previous.indent = indent;
					previous.endAbove = line;
					continue;
				} else {
					// no end marker found, treat line as a regular line
				}
			} else { // end pattern match
				previousRegions.push({ indent: -2, endAbove: line, line });
				continue;
			}
		}
		if (previous.indent > indent) {
			// discard all regions with larger indent
			do {
				previousRegions.pop();
				previous = previousRegions[previousRegions.length - 1];
			} while (previous.indent > indent);

			// new folding range
			let endLineNumber = previous.endAbove - 1;
			if (endLineNumber - line >= 1) { // needs at east size 1
				result.insertFirst(line, endLineNumber, indent);
			}
		}
		if (previous.indent === indent) {
			previous.endAbove = line;
		} else { // previous.indent < indent
			// new region with a bigger indent
			previousRegions.push({ indent, endAbove: line, line });
		}
	}
	return result.toIndentRanges(model);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { onUnexpectedExternalError } from 'vs/base/common/errors';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { ITextModel } from 'vs/editor/common/model';
import { FoldingContext, FoldingRange, FoldingRangeProvider } from 'vs/editor/common/languages';
import { RangeProvider } from './folding';
import { FoldingRegions, MAX_LINE_NUMBER } from './foldingRanges';

export interface IFoldingRangeData extends FoldingRange {
	rank: number;
}

const foldingContext: FoldingContext = {
};

export const ID_SYNTAX_PROVIDER = 'syntax';

export class SyntaxRangeProvider implements RangeProvider {

	readonly id = ID_SYNTAX_PROVIDER;

	readonly disposables: DisposableStore | undefined;

	constructor(private readonly editorModel: ITextModel, private providers: FoldingRangeProvider[], handleFoldingRangesChange: () => void, private limit: number) {
		for (const provider of providers) {
			if (typeof provider.onDidChange === 'function') {
				if (!this.disposables) {
					this.disposables = new DisposableStore();
				}
				this.disposables.add(provider.onDidChange(handleFoldingRangesChange));
			}
		}
	}

	compute(cancellationToken: CancellationToken, notifyTooManyRegions?: (maxRegions: number) => void): Promise<FoldingRegions | null> {
		return collectSyntaxRanges(this.providers, this.editorModel, cancellationToken).then(ranges => {
			if (ranges) {
				let res = sanitizeRanges(ranges, this.limit, notifyTooManyRegions);
				return res;
			}
			return null;
		});
	}

	dispose() {
		this.disposables?.dispose();
	}
}

function collectSyntaxRanges(providers: FoldingRangeProvider[], model: ITextModel, cancellationToken: CancellationToken): Promise<IFoldingRangeData[] | null> {
	let rangeData: IFoldingRangeData[] | null = null;
	let promises = providers.map((provider, i) => {
		return Promise.resolve(provider.provideFoldingRanges(model, foldingContext, cancellationToken)).then(ranges => {
			if (cancellationToken.isCancellationRequested) {
				return;
			}
			if (Array.isArray(ranges)) {
				if (!Array.isArray(rangeData)) {
					rangeData = [];
				}
				let nLines = model.getLineCount();
				for (let r of ranges) {
					if (r.start > 0 && r.end > r.start && r.end <= nLines) {
						rangeData.push({ start: r.start, end: r.end, rank: i, kind: r.kind });
					}
				}
			}
		}, onUnexpectedExternalError);
	});
	return Promise.all(promises).then(_ => {
		return rangeData;
	});
}

export class RangesCollector {
	private readonly _startIndexes: number[];
	private readonly _endIndexes: number[];
	private readonly _nestingLevels: number[];
	private readonly _nestingLevelCounts: number[];
	private readonly _types: Array<string | undefined>;
	private _length: number;
	private readonly _foldingRangesLimit: number;

	constructor(foldingRangesLimit: number, private readonly _notifyTooManyRegions?: (maxRegions: number) => void) {
		this._startIndexes = [];
		this._endIndexes = [];
		this._nestingLevels = [];
		this._nestingLevelCounts = [];
		this._types = [];
		this._length = 0;
		this._foldingRangesLimit = foldingRangesLimit;
	}

	public add(startLineNumber: number, endLineNumber: number, type: string | undefined, nestingLevel: number) {
		if (startLineNumber > MAX_LINE_NUMBER || endLineNumber > MAX_LINE_NUMBER) {
			return;
		}
		let index = this._length;
		this._startIndexes[index] = startLineNumber;
		this._endIndexes[index] = endLineNumber;
		this._nestingLevels[index] = nestingLevel;
		this._types[index] = type;
		this._length++;
		if (nestingLevel < 30) {
			this._nestingLevelCounts[nestingLevel] = (this._nestingLevelCounts[nestingLevel] || 0) + 1;
		}
	}

	public toIndentRanges() {
		if (this._length <= this._foldingRangesLimit) {
			let startIndexes = new Uint32Array(this._length);
			let endIndexes = new Uint32Array(this._length);
			for (let i = 0; i < this._length; i++) {
				startIndexes[i] = this._startIndexes[i];
				endIndexes[i] = this._endIndexes[i];
			}
			return new FoldingRegions(startIndexes, endIndexes, this._types);
		} else {
			if (this._notifyTooManyRegions) {
				this._notifyTooManyRegions(this._foldingRangesLimit);
			}
			let entries = 0;
			let maxLevel = this._nestingLevelCounts.length;
			for (let i = 0; i < this._nestingLevelCounts.length; i++) {
				let n = this._nestingLevelCounts[i];
				if (n) {
					if (n + entries > this._foldingRangesLimit) {
						maxLevel = i;
						break;
					}
					entries += n;
				}
			}

			let startIndexes = new Uint32Array(this._foldingRangesLimit);
			let endIndexes = new Uint32Array(this._foldingRangesLimit);
			let types: Array<string | undefined> = [];
			for (let i = 0, k = 0; i < this._length; i++) {
				let level = this._nestingLevels[i];
				if (level < maxLevel || (level === maxLevel && entries++ < this._foldingRangesLimit)) {
					startIndexes[k] = this._startIndexes[i];
					endIndexes[k] = this._endIndexes[i];
					types[k] = this._types[i];
					k++;
				}
			}
			return new FoldingRegions(startIndexes, endIndexes, types);
		}

	}

}

export function sanitizeRanges(rangeData: IFoldingRangeData[], limit: number, notifyTooManyRegions?: (maxRegions: number) => void): FoldingRegions {
	let sorted = rangeData.sort((d1, d2) => {
		let diff = d1.start - d2.start;
		if (diff === 0) {
			diff = d1.rank - d2.rank;
		}
		return diff;
	});
	let collector = new RangesCollector(limit, notifyTooManyRegions);

	let top: IFoldingRangeData | undefined = undefined;
	let previous: IFoldingRangeData[] = [];
	for (let entry of sorted) {
		if (!top) {
			top = entry;
			collector.add(entry.start, entry.end, entry.kind && entry.kind.value, previous.length);
		} else {
			if (entry.start > top.start) {
				if (entry.end <= top.end) {
					previous.push(top);
					top = entry;
					collector.add(entry.start, entry.end, entry.kind && entry.kind.value, previous.length);
				} else {
					if (entry.start > top.end) {
						do {
							top = previous.pop();
						} while (top && entry.start > top.end);
						if (top) {
							previous.push(top);
						}
						top = entry;
					}
					collector.add(entry.start, entry.end, entry.kind && entry.kind.value, previous.length);
				}
			}
		}
	}
	return collector.toIndentRanges();
}

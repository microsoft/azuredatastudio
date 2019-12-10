/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotebookRange } from 'sql/workbench/contrib/notebook/find/notebookFindDecorations';
import { ICellModel } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { onUnexpectedError } from 'vs/base/common/errors';
import { DidChangeDecorationsEmitter, ModelDecorationOptions, createTextBuffer } from 'vs/editor/common/model/textModel';
import { Disposable } from 'vs/base/common/lifecycle';
import { IModelDecorationsChangedEvent } from 'vs/editor/common/model/textModelEvents';
import { Range, IRange } from 'vs/editor/common/core/range';
import * as model from 'vs/editor/common/model';
import { Event } from 'vs/base/common/event';
import { singleLetterHash, isHighSurrogate } from 'vs/base/common/strings';
import { NotebookModel } from 'sql/workbench/contrib/notebook/browser/models/notebookModel';
import { IntervalNode } from 'vs/editor/common/model/intervalTree';


function _normalizeOptions(options: model.IModelDecorationOptions): ModelDecorationOptions {
	if (options instanceof ModelDecorationOptions) {
		return options;
	}
	return ModelDecorationOptions.createDynamic(options);
}

const invalidFunc = () => { throw new Error(`Invalid change accessor`); };

let MODEL_ID = 0;

export class NotebookFindImpl extends Disposable {

	//#region Decorations
	private readonly _onDidChangeDecorations: DidChangeDecorationsEmitter = this._register(new DidChangeDecorationsEmitter());
	public readonly onDidChangeDecorations: Event<IModelDecorationsChangedEvent> = this._onDidChangeDecorations.event;
	private _decorations: { [decorationId: string]: NotebookIntervalNode; };

	private _buffer: model.ITextBuffer;
	private readonly _instanceId: string;
	private _lastDecorationId: number;
	private _versionId: number;

	constructor() {
		super();
		this._instanceId = singleLetterHash(MODEL_ID);
		this._lastDecorationId = 0;
		// Generate a new unique model id
		MODEL_ID++;

		this._decorations = Object.create(null);

		this._buffer = createTextBuffer('', NotebookModel.DEFAULT_CREATION_OPTIONS.defaultEOL);
		this._versionId = 1;
	}

	public get VersionId(): number {
		return this._versionId;
	}

	public emitChangeDecorations(begin: boolean): void {
		if (begin) {
			this._onDidChangeDecorations.beginDeferredEmit();
		} else {
			this._onDidChangeDecorations.endDeferredEmit();
		}
	}

	public get Buffer(): model.ITextBuffer {
		return this._buffer;
	}

	public get ModelId(): number {
		return MODEL_ID;
	}

	public ChangeDecorations<T>(ownerId: number, callback: (changeAccessor: model.IModelDecorationsChangeAccessor) => T): T | null {
		let changeAccessor: model.IModelDecorationsChangeAccessor = {
			addDecoration: (range: IRange, options: model.IModelDecorationOptions): string => {
				this._onDidChangeDecorations.fire();
				return this._deltaDecorationsImpl(ownerId, [], [{ range: range, options: options }])[0];
			},
			changeDecoration: (id: string, newRange: IRange): void => {
				this._onDidChangeDecorations.fire();
				this._changeDecorationImpl(id, newRange);
			},
			changeDecorationOptions: (id: string, options: model.IModelDecorationOptions) => {
				this._onDidChangeDecorations.fire();
				this._changeDecorationOptionsImpl(id, _normalizeOptions(options));
			},
			removeDecoration: (id: string): void => {
				this._onDidChangeDecorations.fire();
				this._deltaDecorationsImpl(ownerId, [id], []);
			},
			deltaDecorations: (oldDecorations: string[], newDecorations: model.IModelDeltaDecoration[]): string[] => {
				if (oldDecorations.length === 0 && newDecorations.length === 0) {
					// nothing to do
					return [];
				}
				this._onDidChangeDecorations.fire();
				return this._deltaDecorationsImpl(ownerId, oldDecorations, newDecorations);
			}
		};
		let result: T | null = null;
		try {
			result = callback(changeAccessor);
		} catch (e) {
			onUnexpectedError(e);
		}
		// Invalidate change accessor
		changeAccessor.addDecoration = invalidFunc;
		changeAccessor.changeDecoration = invalidFunc;
		changeAccessor.changeDecorationOptions = invalidFunc;
		changeAccessor.removeDecoration = invalidFunc;
		changeAccessor.deltaDecorations = invalidFunc;
		return result;
	}

	public getRangeAt(cell: ICellModel, start: number, end: number): NotebookRange {
		return this._getRangeAt(cell, start, end);
	}

	private _getRangeAt(cell: ICellModel, start: number, end: number): NotebookRange {
		let range: Range = this._buffer.getRangeAt(start, end - start);
		return new NotebookRange(cell, range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
	}

	/**
	 * @param range the range to check for validity
	 * @param strict Do NOT allow a range to have its boundaries inside a high-low surrogate pair
	 */
	private _isValidRange(range: NotebookRange, strict: boolean): boolean {
		const startLineNumber = range.startLineNumber;
		const startColumn = range.startColumn;
		const endLineNumber = range.endLineNumber;
		const endColumn = range.endColumn;

		if (!this._isValidPosition(startLineNumber, startColumn, false)) {
			return false;
		}
		if (!this._isValidPosition(endLineNumber, endColumn, false)) {
			return false;
		}

		if (strict) {
			const charCodeBeforeStart = (startColumn > 1 ? this._buffer.getLineCharCode(startLineNumber, startColumn - 2) : 0);
			const charCodeBeforeEnd = (endColumn > 1 && endColumn <= this._buffer.getLineLength(endLineNumber) ? this._buffer.getLineCharCode(endLineNumber, endColumn - 2) : 0);

			const startInsideSurrogatePair = isHighSurrogate(charCodeBeforeStart);
			const endInsideSurrogatePair = isHighSurrogate(charCodeBeforeEnd);

			if (!startInsideSurrogatePair && !endInsideSurrogatePair) {
				return true;
			}

			return false;
		}

		return true;
	}

	private _isValidPosition(lineNumber: number, column: number, strict: boolean): boolean {
		if (typeof lineNumber !== 'number' || typeof column !== 'number') {
			return false;
		}

		if (isNaN(lineNumber) || isNaN(column)) {
			return false;
		}

		if (lineNumber < 0 || column < 1) {
			return false;
		}

		if ((lineNumber | 0) !== lineNumber || (column | 0) !== column) {
			return false;
		}

		const lineCount = this._buffer.getLineCount();
		if (lineNumber > lineCount) {
			return false;
		}

		if (strict) {
			if (column > 1) {
				const charCodeBefore = this._buffer.getLineCharCode(lineNumber, column - 2);
				if (isHighSurrogate(charCodeBefore)) {
					return false;
				}
			}
		}

		return true;
	}

	getLineMaxColumn(lineNumber: number): number {
		if (lineNumber < 1 || lineNumber > this.getLineCount()) {
			throw new Error('Illegal value for lineNumber');
		}
		return this._buffer.getLineLength(lineNumber) + 1;
	}

	getLineCount(): number {
		return this._buffer.getLineCount();
	}

	public getVersionId(): number {
		return this._versionId;
	}

	public validateRange(_range: IRange): NotebookRange {
		// Avoid object allocation and cover most likely case
		if ((_range instanceof NotebookRange) && !(_range instanceof Selection)) {
			if (this._isValidRange(_range, true)) {
				return _range;
			}
		}

		return undefined;
	}

	/**
	 * Validates `range` is within buffer bounds, but allows it to sit in between surrogate pairs, etc.
	 * Will try to not allocate if possible.
	 */
	private _validateRangeRelaxedNoAllocations(range: IRange): NotebookRange {
		if (range instanceof NotebookRange) {
			this._buffer = createTextBuffer(range.cell.source instanceof Array ? range.cell.source.join('\n') : range.cell.source, NotebookModel.DEFAULT_CREATION_OPTIONS.defaultEOL);
		}

		const linesCount = this._buffer.getLineCount();

		const initialStartLineNumber = range.startLineNumber;
		const initialStartColumn = range.startColumn;
		let startLineNumber: number;
		let startColumn: number;

		if (initialStartLineNumber < 1) {
			startLineNumber = 1;
			startColumn = 1;
		} else if (initialStartLineNumber > linesCount) {
			startLineNumber = linesCount;
			startColumn = this.getLineMaxColumn(startLineNumber);
		} else {
			startLineNumber = initialStartLineNumber | 0;
			if (initialStartColumn <= 1) {
				startColumn = 1;
			} else {
				const maxColumn = this.getLineMaxColumn(startLineNumber);
				if (initialStartColumn >= maxColumn) {
					startColumn = maxColumn;
				} else {
					startColumn = initialStartColumn | 0;
				}
			}
		}

		const initialEndLineNumber = range.endLineNumber;
		const initialEndColumn = range.endColumn;
		let endLineNumber: number;
		let endColumn: number;

		if (initialEndLineNumber < 1) {
			endLineNumber = 1;
			endColumn = 1;
		} else if (initialEndLineNumber > linesCount) {
			endLineNumber = linesCount;
			endColumn = this.getLineMaxColumn(endLineNumber);
		} else {
			endLineNumber = initialEndLineNumber | 0;
			if (initialEndColumn <= 1) {
				endColumn = 1;
			} else {
				const maxColumn = this.getLineMaxColumn(endLineNumber);
				if (initialEndColumn >= maxColumn) {
					endColumn = maxColumn;
				} else {
					endColumn = initialEndColumn | 0;
				}
			}
		}

		if (
			initialStartLineNumber === startLineNumber
			&& initialStartColumn === startColumn
			&& initialEndLineNumber === endLineNumber
			&& initialEndColumn === endColumn
			&& range instanceof NotebookRange
			&& !(range instanceof Selection)
		) {
			return range;
		}

		if (range instanceof NotebookRange) {
			return range;
		}
		return new NotebookRange(undefined, startLineNumber, startColumn, endLineNumber, endColumn);
	}

	private _changeDecorationImpl(decorationId: string, _range: IRange): void {
		const node = this._decorations[decorationId];
		if (!node) {
			return;
		}
		const range = this._validateRangeRelaxedNoAllocations(_range);
		const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
		const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);
		node.node.reset(this.getVersionId(), startOffset, endOffset, range);
	}

	private _changeDecorationOptionsImpl(decorationId: string, options: ModelDecorationOptions): void {
		const node = this._decorations[decorationId];
		if (!node) {
			return;
		}

		const nodeWasInOverviewRuler = (node.node.options.overviewRuler && node.node.options.overviewRuler.color ? true : false);
		const nodeIsInOverviewRuler = (options.overviewRuler && options.overviewRuler.color ? true : false);

		if (nodeWasInOverviewRuler !== nodeIsInOverviewRuler) {
			// Delete + Insert due to an overview ruler status change
			node.node.setOptions(options);
		} else {
			node.node.setOptions(options);
		}
	}

	private _deltaDecorationsImpl(ownerId: number, oldDecorationsIds: string[], newDecorations: model.IModelDeltaDecoration[]): string[] {
		const versionId = this.getVersionId();


		const oldDecorationsLen = oldDecorationsIds.length;
		let oldDecorationIndex = 0;

		const newDecorationsLen = newDecorations.length;
		let newDecorationIndex = 0;

		let result = new Array<string>(newDecorationsLen);
		while (oldDecorationIndex < oldDecorationsLen || newDecorationIndex < newDecorationsLen) {

			let node: IntervalNode | null = null;
			let cell: ICellModel | null = null;

			if (oldDecorationIndex < oldDecorationsLen) {
				// (1) get ourselves an old node
				do {
					node = this._decorations[oldDecorationsIds[oldDecorationIndex++]].node;
				} while (!node && oldDecorationIndex < oldDecorationsLen);

				// (2) remove the node from the tree (if it exists)
				if (node) {
					//this._decorationsTree.delete(node);
				}
			}

			if (newDecorationIndex < newDecorationsLen) {
				// (3) create a new node if necessary
				if (!node) {
					const internalDecorationId = (++this._lastDecorationId);
					const decorationId = `${this._instanceId};${internalDecorationId}`;
					node = new IntervalNode(decorationId, 0, 0);
					this._decorations[decorationId] = new NotebookIntervalNode(node, cell);
				}

				// (4) initialize node
				const newDecoration = newDecorations[newDecorationIndex];
				const range = this._validateRangeRelaxedNoAllocations(newDecoration.range);
				const options = _normalizeOptions(newDecoration.options);
				const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
				const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);

				node.ownerId = ownerId;
				node.reset(versionId, startOffset, endOffset, range);
				node.setOptions(options);

				this._decorations[node.id].cell = range.cell;
				this._decorations[node.id].node = node;
				//this._decorationsTree.insert(node);

				result[newDecorationIndex] = node.id;

				newDecorationIndex++;
			} else {
				if (node) {
					delete this._decorations[node.id];
				}
			}
		}

		return result;
	}

	public getDecorationRange(id: string): NotebookRange | null {
		const node = this._decorations[id];
		if (!node) {
			return null;
		}

		let range = node.node.range;
		if (range === null) {
			node.node.range = this._getRangeAt(node.cell, node.node.cachedAbsoluteStart, node.node.cachedAbsoluteEnd);
		}
		return new NotebookRange(node.cell, node.node.range.startLineNumber, node.node.range.startColumn, node.node.range.endLineNumber, node.node.range.endColumn);
	}



}

export class NotebookIntervalNode {

	constructor(public node: IntervalNode, public cell: ICellModel) {

	}
}


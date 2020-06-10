/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { ICellModel, INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INotebookFindModel } from 'sql/workbench/contrib/notebook/browser/models/notebookFindModel';
import { Event, Emitter } from 'vs/base/common/event';
import * as types from 'vs/base/common/types';
import { NotebookFindMatch, NotebookFindDecorations } from 'sql/workbench/contrib/notebook/browser/find/notebookFindDecorations';
import * as model from 'vs/editor/common/model';
import { ModelDecorationOptions, DidChangeDecorationsEmitter, createTextBuffer } from 'vs/editor/common/model/textModel';
import { IModelDecorationsChangedEvent } from 'vs/editor/common/model/textModelEvents';
import { IntervalNode } from 'vs/editor/common/model/intervalTree';
import { EDITOR_MODEL_DEFAULTS } from 'vs/editor/common/config/editorOptions';
import { Range, IRange } from 'vs/editor/common/core/range';
import { onUnexpectedError } from 'vs/base/common/errors';
import { singleLetterHash, isHighSurrogate } from 'vs/base/common/strings';
import { Command, ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { NotebookEditor } from 'sql/workbench/contrib/notebook/browser/notebookEditor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { NOTEBOOK_COMMAND_SEARCH } from 'sql/workbench/services/notebook/common/notebookContext';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { ActiveEditorContext } from 'vs/workbench/common/editor';
import { NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';

function _normalizeOptions(options: model.IModelDecorationOptions): ModelDecorationOptions {
	if (options instanceof ModelDecorationOptions) {
		return options;
	}
	return ModelDecorationOptions.createDynamic(options);
}

const invalidFunc = () => { throw new Error(`Invalid change accessor`); };

let MODEL_ID = 0;

export class NotebookFindModel extends Disposable implements INotebookFindModel {

	private _findArray: Array<NotebookRange>;
	private _findIndex: number = 0;
	private _onFindCountChange = new Emitter<number>();
	private _isDisposed: boolean;
	public readonly id: string;
	private _buffer: model.ITextBuffer;
	private readonly _instanceId: string;
	private _lastDecorationId: number;
	private _versionId: number;
	private _findDecorations: NotebookFindDecorations;
	public currentMatch: NotebookRange;
	public previousMatch: NotebookRange;
	public findExpression: string;

	//#region Decorations
	private readonly _onDidChangeDecorations: DidChangeDecorationsEmitter = this._register(new DidChangeDecorationsEmitter());
	public readonly onDidChangeDecorations: Event<IModelDecorationsChangedEvent> = this._onDidChangeDecorations.event;
	private _decorations: { [decorationId: string]: NotebookIntervalNode; };
	//#endregion

	constructor(private _notebookModel: INotebookModel) {
		super();

		this._isDisposed = false;

		this._instanceId = singleLetterHash(MODEL_ID);
		this._lastDecorationId = 0;
		// Generate a new unique model id
		MODEL_ID++;

		this._decorations = Object.create(null);

		this._buffer = createTextBuffer('', NotebookFindModel.DEFAULT_CREATION_OPTIONS.defaultEOL);
		this._versionId = 1;
		this.id = '$model' + MODEL_ID;
	}

	public set notebookModel(model: INotebookModel) {
		this._notebookModel = model;
	}

	public get notebookModel(): INotebookModel {
		return this._notebookModel;
	}

	public get findDecorations(): NotebookFindDecorations {
		return this._findDecorations;
	}

	public setNotebookFindDecorations(editor: NotebookEditor): void {
		this._findDecorations = new NotebookFindDecorations(editor);
		this._findDecorations.setStartPosition(this.getPosition());
	}

	public clearDecorations(): void {
		this._findDecorations.dispose();
		this.clearFind();
	}

	public static DEFAULT_CREATION_OPTIONS: model.ITextModelCreationOptions = {
		isForSimpleWidget: false,
		tabSize: EDITOR_MODEL_DEFAULTS.tabSize,
		indentSize: EDITOR_MODEL_DEFAULTS.indentSize,
		insertSpaces: EDITOR_MODEL_DEFAULTS.insertSpaces,
		detectIndentation: false,
		defaultEOL: model.DefaultEndOfLine.LF,
		trimAutoWhitespace: EDITOR_MODEL_DEFAULTS.trimAutoWhitespace,
		largeFileOptimizations: EDITOR_MODEL_DEFAULTS.largeFileOptimizations,
	};

	public get onFindCountChange(): Event<number> { return this._onFindCountChange.event; }

	public get VersionId(): number {
		return this._versionId;
	}

	public get Buffer(): model.ITextBuffer {
		return this._buffer;
	}

	public get ModelId(): number {
		return MODEL_ID;
	}

	public getPosition(): NotebookRange {
		return this.currentMatch;
	}

	public getLastPosition(): NotebookRange {
		return this.previousMatch;
	}

	public setSelection(range: NotebookRange): void {
		this.previousMatch = this.currentMatch;
		this.currentMatch = range;
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
			this._buffer = createTextBuffer(range.cell.source instanceof Array ? range.cell.source.join('\n') : range.cell.source, NotebookFindModel.DEFAULT_CREATION_OPTIONS.defaultEOL);
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
					let decorationNode = this._decorations[oldDecorationsIds[oldDecorationIndex++]];
					node = decorationNode?.node;
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


	findNext(): Promise<NotebookRange> {
		if (this._findArray && this._findArray.length !== 0) {
			if (this._findIndex === this._findArray.length - 1) {
				this._findIndex = 0;
			} else {
				++this._findIndex;
			}
			return Promise.resolve(this._findArray[this._findIndex]);
		} else {
			return Promise.reject(new Error('no search running'));
		}
	}

	findPrevious(): Promise<NotebookRange> {
		if (this._findArray && this._findArray.length !== 0) {
			if (this._findIndex === 0) {
				this._findIndex = this._findArray.length - 1;
			} else {
				--this._findIndex;
			}
			return Promise.resolve(this._findArray[this._findIndex]);
		} else {
			return Promise.reject(new Error('no search running'));
		}
	}

	find(exp: string, matchCase?: boolean, wholeWord?: boolean, maxMatches?: number): Promise<NotebookRange> {
		this._findArray = new Array<NotebookRange>();
		this._onFindCountChange.fire(this._findArray.length);
		if (exp) {
			for (let i = 0; i < this.notebookModel.cells.length; i++) {
				const item = this.notebookModel.cells[i];
				const result = this.searchFn(item, exp, matchCase, wholeWord, maxMatches);
				if (result) {
					this._findArray.push(...result);
					this._onFindCountChange.fire(this._findArray.length);
					if (maxMatches > 0 && this._findArray.length === maxMatches) {
						break;
					}
				}
			}
			return Promise.resolve(this._findArray[this._findIndex]);
		} else {
			return Promise.reject(new Error('no expression'));
		}
	}

	public get findMatches(): NotebookFindMatch[] {
		let findMatches: NotebookFindMatch[] = [];
		this._findArray.forEach(element => {
			findMatches = findMatches.concat(new NotebookFindMatch(element, null));
		});
		return findMatches;
	}

	public get findArray(): NotebookRange[] {
		return this._findArray;
	}

	getIndexByRange(range: NotebookRange): number {
		let index = this.findArray.findIndex(r => r.cell.cellGuid === range.cell.cellGuid && r.startColumn === range.startColumn && r.endColumn === range.endColumn && r.startLineNumber === range.startLineNumber && r.endLineNumber === range.endLineNumber && r.isMarkdownSourceCell === range.isMarkdownSourceCell);
		this._findIndex = index > -1 ? index : this._findIndex;
		// _findIndex is the 0 based index, return index + 1 for the actual count on UI
		return this._findIndex + 1;
	}

	private searchFn(cell: ICellModel, exp: string, matchCase: boolean = false, wholeWord: boolean = false, maxMatches?: number): NotebookRange[] {
		let findResults: NotebookRange[] = [];
		if (cell.cellType === 'markdown' && cell.isEditMode && typeof cell.source !== 'string') {
			let cellSource = cell.source;
			for (let j = 0; j < cellSource.length; j++) {
				let findStartResults = this.search(cellSource[j], exp, matchCase, wholeWord, maxMatches - findResults.length);
				findStartResults.forEach(start => {
					// lineNumber: j+1 since notebook editors aren't zero indexed.
					let range = new NotebookRange(cell, j + 1, start, j + 1, start + exp.length, true);
					findResults.push(range);
				});
			}
		}
		let cellVal = cell.cellType === 'markdown' ? cell.renderedOutputTextContent : cell.source;
		if (cellVal) {
			if (typeof cellVal === 'string') {
				let findStartResults = this.search(cellVal, exp, matchCase, wholeWord, maxMatches);
				findStartResults.forEach(start => {
					let range = new NotebookRange(cell, 0, start, 0, start + exp.length);
					findResults.push(range);
				});

			} else {
				for (let j = 0; j < cellVal.length; j++) {
					let cellValFormatted = cell.cellType === 'markdown' ? this.cleanMarkdownLinks(cellVal[j]) : cellVal[j];
					let findStartResults = this.search(cellValFormatted, exp, matchCase, wholeWord, maxMatches - findResults.length);
					findStartResults.forEach(start => {
						// lineNumber: j+1 since notebook editors aren't zero indexed.
						let range = new NotebookRange(cell, j + 1, start, j + 1, start + exp.length);
						findResults.push(range);
					});
				}
			}
		}
		return findResults;
	}

	// escape the special characters in a regex string
	escapeRegExp(text: string): string {
		return text.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
	}

	search(input: string, exp: string, matchCase: boolean = false, wholeWord: boolean = false, maxMatches?: number): number[] {
		let index: number = 0;
		let start: number;
		let findResults: number[] = [];
		if (!matchCase) {
			input = input.toLocaleLowerCase();
			exp = exp.toLocaleLowerCase();
		}
		let searchText: string = input.substr(index);
		while (findResults.length < maxMatches && searchText.indexOf(exp) > -1) {
			if (wholeWord) {
				// word with no special characters around \\bword\\b, word that begins or ends with special character \\sword\\s
				let wholeWordRegex = new RegExp(`(?:\\b|\\s)${this.escapeRegExp(exp)}(?:\\b|\\s)`);
				start = searchText.search(wholeWordRegex) + 1;
				if (start < 1) {
					break;
				}
			} else {
				start = searchText.indexOf(exp) + index;
				// Editors aren't 0-based; the first character position in an editor is 1, so adding 1 to the first found index
				if (index === 0) {
					start++;
				}
			}
			findResults.push(start);
			index = start + exp.length;
			searchText = input.substr(index - 1);
		}
		return findResults;
	}

	// In markdown links are defined as [Link Text](https://url/of/the/text). when searching for text we shouldn't
	// look for the values inside the (), below regex replaces that with just the Link Text.
	cleanMarkdownLinks(cellSrc: string): string {
		return cellSrc.replace(/(?:__|[*#])|\[(.*?)\]\(.*?\)/gm, '$1');
	}

	clearFind(): void {
		this._findArray = new Array<NotebookRange>();
		this._findIndex = 0;
		this._onFindCountChange.fire(this._findArray.length);
	}

	getFindIndex(): number {
		return types.isUndefinedOrNull(this._findIndex) ? 0 : this._findIndex + 1;
	}

	getFindCount(): number {
		return types.isUndefinedOrNull(this._findArray) ? 0 : this._findArray.length;
	}


	//#region Decorations

	public isDisposed(): boolean {
		return this._isDisposed;
	}

	private _assertNotDisposed(): void {
		if (this._isDisposed) {
			throw new Error('Model is disposed!');
		}
	}

	public changeDecorations<T>(callback: (changeAccessor: model.IModelDecorationsChangeAccessor) => T, ownerId: number = 0): T | null {
		this._assertNotDisposed();

		try {
			this._onDidChangeDecorations.beginDeferredEmit();
			return this.ChangeDecorations(ownerId, callback);
		} finally {
			this._onDidChangeDecorations.endDeferredEmit();
		}
	}

	public dispose(): void {
		super.dispose();
		this._findArray = [];
		this._isDisposed = true;
	}

}

export class NotebookIntervalNode extends IntervalNode {

	constructor(public node: IntervalNode, public cell: ICellModel) {
		super(node.id, node.start, node.end);
	}
}

abstract class SettingsCommand extends Command {

	protected getNotebookEditor(accessor: ServicesAccessor): NotebookEditor {
		const activeEditor = accessor.get(IEditorService).activeEditorPane;
		if (activeEditor instanceof NotebookEditor) {
			return activeEditor;
		}
		return null;
	}

}

class SearchNotebookCommand extends SettingsCommand {

	public async runCommand(accessor: ServicesAccessor, args: any): Promise<void> {
		const notebookEditor = this.getNotebookEditor(accessor);
		if (notebookEditor) {
			await notebookEditor.setNotebookModel();
			notebookEditor.toggleSearch();
		}
	}

}

export const findCommand = new SearchNotebookCommand({
	id: NOTEBOOK_COMMAND_SEARCH,
	precondition: ActiveEditorContext.isEqualTo(NotebookEditor.ID),
	kbOpts: {
		primary: KeyMod.CtrlCmd | KeyCode.KEY_F,
		weight: KeybindingWeight.EditorContrib
	}
});
findCommand.register();

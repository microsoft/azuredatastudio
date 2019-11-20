/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from 'vs/base/common/lifecycle';
import { IModelDecorationsChangeAccessor, IModelDeltaDecoration, OverviewRulerLane, TrackedRangeStickiness, MinimapPosition } from 'vs/editor/common/model';
import { ModelDecorationOptions } from 'vs/editor/common/model/textModel';
import { overviewRulerFindMatchForeground, minimapFindMatch } from 'vs/platform/theme/common/colorRegistry';
import { themeColorFromId } from 'vs/platform/theme/common/themeService';
import { NotebookEditor } from 'sql/workbench/contrib/notebook/browser/notebookEditor';
import { NotebookRange, NotebookFindMatch } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';

export class FindDecorations implements IDisposable {

	private readonly _editor: NotebookEditor;
	private _decorations: string[];
	private _overviewRulerApproximateDecorations: string[];
	private _findScopeDecorationId: string | null;
	private _rangeHighlightDecorationId: string | null;
	private _highlightedDecorationId: string | null;
	private _startPosition: NotebookRange;
	private _currentMatch: NotebookRange;

	constructor(editor: NotebookEditor) {
		this._editor = editor;
		this._decorations = [];
		this._overviewRulerApproximateDecorations = [];
		this._findScopeDecorationId = null;
		this._rangeHighlightDecorationId = null;
		this._highlightedDecorationId = null;
		this._startPosition = this._editor.getPosition();
	}

	public dispose(): void {
		this._editor.deltaDecorations(this._allDecorations(), []);

		this._decorations = [];
		this._overviewRulerApproximateDecorations = [];
		this._findScopeDecorationId = null;
		this._rangeHighlightDecorationId = null;
		this._highlightedDecorationId = null;
	}

	public reset(): void {
		this._decorations = [];
		this._overviewRulerApproximateDecorations = [];
		this._findScopeDecorationId = null;
		this._rangeHighlightDecorationId = null;
		this._highlightedDecorationId = null;
	}

	public getCount(): number {
		return this._decorations.length;
	}

	public getFindScope(): NotebookRange | null {
		if (this._findScopeDecorationId) {
			return this._editor.getNotebookModel().getDecorationRange(this._findScopeDecorationId);
		}
		return null;
	}

	public getStartPosition(): NotebookRange {
		return this._startPosition;
	}

	public setStartPosition(newStartPosition: NotebookRange): void {
		if (newStartPosition) {
			this._startPosition = newStartPosition;
			this.setCurrentFindMatch(this._startPosition);
		}
	}

	private _getDecorationIndex(decorationId: string): number {
		const index = this._decorations.indexOf(decorationId);
		if (index >= 0) {
			return index + 1;
		}
		return 1;
	}

	public getCurrentMatchesPosition(desiredRange: NotebookRange): number {
		let candidates = this._editor.getNotebookModel().getDecorationsInRange(desiredRange);
		for (const candidate of candidates) {
			const candidateOpts = candidate.options;
			if (candidateOpts === FindDecorations._FIND_MATCH_DECORATION || candidateOpts === FindDecorations._CURRENT_FIND_MATCH_DECORATION) {
				return this._getDecorationIndex(candidate.id);
			}
		}
		return 1;
	}

	public clearDecorations(): void {
		this.removePrevDecorations();
	}

	public setCurrentFindMatch(nextMatch: NotebookRange | null): number {
		let newCurrentDecorationId: string | null = null;
		let matchPosition = 0;
		if (nextMatch) {
			for (let i = 0, len = this._decorations.length; i < len; i++) {
				let range = this._editor.getNotebookModel().getDecorationRange(this._decorations[i]);
				if (nextMatch.equalsRange(range)) {
					newCurrentDecorationId = this._decorations[i];
					matchPosition = (i + 1);
					break;
				}
			}
		}

		if (this._highlightedDecorationId !== null || newCurrentDecorationId !== null) {
			this.removePrevDecorations();
			if (this.checkValidEditor(nextMatch)) {
				this._editor.getCellEditor(nextMatch.cell.cellGuid).getControl().changeDecorations((changeAccessor: IModelDecorationsChangeAccessor) => {
					if (this._highlightedDecorationId !== null) {
						changeAccessor.changeDecorationOptions(this._highlightedDecorationId, FindDecorations._FIND_MATCH_DECORATION);
						this._highlightedDecorationId = null;
					}
					if (newCurrentDecorationId !== null) {
						this._highlightedDecorationId = newCurrentDecorationId;
						changeAccessor.changeDecorationOptions(this._highlightedDecorationId, FindDecorations._CURRENT_FIND_MATCH_DECORATION);
					}

					if (newCurrentDecorationId !== null) {
						let rng = this._editor.getNotebookModel().getDecorationRange(newCurrentDecorationId)!;
						if (rng.startLineNumber !== rng.endLineNumber && rng.endColumn === 1) {
							let lineBeforeEnd = rng.endLineNumber - 1;
							let lineBeforeEndMaxColumn = this._editor.getNotebookModel().getLineMaxColumn(lineBeforeEnd);
							rng = new NotebookRange(rng.cell, rng.startLineNumber, rng.startColumn, lineBeforeEnd, lineBeforeEndMaxColumn);
						}
						this._rangeHighlightDecorationId = changeAccessor.addDecoration(rng, FindDecorations._RANGE_HIGHLIGHT_DECORATION);
						this._currentMatch = nextMatch;
					}
				});
			}
			else {
				this._editor.updateDecorations(nextMatch, undefined);
				this._currentMatch = nextMatch;
			}
		}

		return matchPosition;
	}

	private removePrevDecorations(): void {
		if (this._currentMatch && this._currentMatch.cell) {
			let pevEditor = this._editor.getCellEditor(this._currentMatch.cell.cellGuid);
			if (pevEditor) {
				pevEditor.getControl().changeDecorations((changeAccessor: IModelDecorationsChangeAccessor) => {
					changeAccessor.removeDecoration(this._rangeHighlightDecorationId);
					this._rangeHighlightDecorationId = null;
				});
			} else {
				if (this._currentMatch.cell.cellType === 'markdown') {
					this._editor.updateDecorations(undefined, this._currentMatch);
				}
			}
		}
	}

	public checkValidEditor(range: NotebookRange): boolean {
		return range && range.cell && !!(this._editor.getCellEditor(range.cell.cellGuid));
	}

	public set(findMatches: NotebookFindMatch[], findScope: NotebookRange | null): void {
		this._editor.changeDecorations((accessor) => {

			let findMatchesOptions: ModelDecorationOptions = FindDecorations._FIND_MATCH_DECORATION;
			let newOverviewRulerApproximateDecorations: IModelDeltaDecoration[] = [];

			if (findMatches.length > 1000) {
				// we go into a mode where the overview ruler gets "approximate" decorations
				// the reason is that the overview ruler paints all the decorations in the file and we don't want to cause freezes
				findMatchesOptions = FindDecorations._FIND_MATCH_NO_OVERVIEW_DECORATION;

				// approximate a distance in lines where matches should be merged
				const lineCount = this._editor.getNotebookModel().getLineCount();
				const height = this._editor.getConfiguration().layoutInfo.height;
				const approxPixelsPerLine = height / lineCount;
				const mergeLinesDelta = Math.max(2, Math.ceil(3 / approxPixelsPerLine));

				// merge decorations as much as possible
				let prevStartLineNumber = findMatches[0].range.startLineNumber;
				let prevEndLineNumber = findMatches[0].range.endLineNumber;
				for (let i = 1, len = findMatches.length; i < len; i++) {
					const range: NotebookRange = findMatches[i].range;
					if (prevEndLineNumber + mergeLinesDelta >= range.startLineNumber) {
						if (range.endLineNumber > prevEndLineNumber) {
							prevEndLineNumber = range.endLineNumber;
						}
					} else {
						newOverviewRulerApproximateDecorations.push({
							range: new NotebookRange(range.cell, prevStartLineNumber, 1, prevEndLineNumber, 1),
							options: FindDecorations._FIND_MATCH_ONLY_OVERVIEW_DECORATION
						});
						prevStartLineNumber = range.startLineNumber;
						prevEndLineNumber = range.endLineNumber;
					}
				}

				newOverviewRulerApproximateDecorations.push({
					range: new NotebookRange(findMatches[0].range.cell, prevStartLineNumber, 1, prevEndLineNumber, 1),
					options: FindDecorations._FIND_MATCH_ONLY_OVERVIEW_DECORATION
				});
			}

			// Find matches
			let newFindMatchesDecorations: IModelDeltaDecoration[] = new Array<IModelDeltaDecoration>(findMatches.length);
			for (let i = 0, len = findMatches.length; i < len; i++) {
				newFindMatchesDecorations[i] = {
					range: findMatches[i].range,
					options: findMatchesOptions
				};
			}
			this._decorations = accessor.deltaDecorations(this._decorations, newFindMatchesDecorations);

			// Overview ruler approximate decorations
			this._overviewRulerApproximateDecorations = accessor.deltaDecorations(this._overviewRulerApproximateDecorations, newOverviewRulerApproximateDecorations);

			// Range highlight
			if (this._rangeHighlightDecorationId) {
				accessor.removeDecoration(this._rangeHighlightDecorationId);
				this._rangeHighlightDecorationId = null;
			}

			// Find scope
			if (this._findScopeDecorationId) {
				accessor.removeDecoration(this._findScopeDecorationId);
				this._findScopeDecorationId = null;
			}
			if (findScope) {
				this._currentMatch = findScope;
				this._findScopeDecorationId = accessor.addDecoration(findScope, FindDecorations._FIND_SCOPE_DECORATION);
			}
		});
	}

	public matchBeforePosition(position: NotebookRange): NotebookRange | null {
		if (this._decorations.length === 0) {
			return null;
		}
		for (let i = this._decorations.length - 1; i >= 0; i--) {
			let decorationId = this._decorations[i];
			let r = this._editor.getNotebookModel().getDecorationRange(decorationId);
			if (!r || r.endLineNumber > position.lineNumber) {
				continue;
			}
			if (r.endLineNumber < position.lineNumber) {
				return r;
			}
			if (r.endColumn > position.startColumnNumber) {
				continue;
			}
			return r;
		}

		return this._editor.getNotebookModel().getDecorationRange(this._decorations[this._decorations.length - 1]);
	}

	public matchAfterPosition(position: NotebookRange): NotebookRange | null {
		if (this._decorations.length === 0) {
			return null;
		}
		for (let i = 0, len = this._decorations.length; i < len; i++) {
			let decorationId = this._decorations[i];
			let r = this._editor.getNotebookModel().getDecorationRange(decorationId);
			if (!r || r.startLineNumber < position.lineNumber) {
				continue;
			}
			if (r.startLineNumber > position.lineNumber) {
				return r;
			}
			if (r.startColumn < position.startColumnNumber) {
				continue;
			}
			return r;
		}

		return this._editor.getNotebookModel().getDecorationRange(this._decorations[0]);
	}

	private _allDecorations(): string[] {
		let result: string[] = [];
		result = result.concat(this._decorations);
		result = result.concat(this._overviewRulerApproximateDecorations);
		if (this._findScopeDecorationId) {
			result.push(this._findScopeDecorationId);
		}
		if (this._rangeHighlightDecorationId) {
			result.push(this._rangeHighlightDecorationId);
		}
		return result;
	}

	private static readonly _CURRENT_FIND_MATCH_DECORATION = ModelDecorationOptions.register({
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		zIndex: 13,
		className: 'currentFindMatch',
		showIfCollapsed: true,
		overviewRuler: {
			color: themeColorFromId(overviewRulerFindMatchForeground),
			position: OverviewRulerLane.Center
		},
		minimap: {
			color: themeColorFromId(minimapFindMatch),
			position: MinimapPosition.Inline
		}
	});

	private static readonly _FIND_MATCH_DECORATION = ModelDecorationOptions.register({
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		className: 'findMatch',
		showIfCollapsed: true,
		overviewRuler: {
			color: themeColorFromId(overviewRulerFindMatchForeground),
			position: OverviewRulerLane.Center
		},
		minimap: {
			color: themeColorFromId(minimapFindMatch),
			position: MinimapPosition.Inline
		}
	});

	private static readonly _FIND_MATCH_NO_OVERVIEW_DECORATION = ModelDecorationOptions.register({
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		className: 'findMatch',
		showIfCollapsed: true
	});

	private static readonly _FIND_MATCH_ONLY_OVERVIEW_DECORATION = ModelDecorationOptions.register({
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		overviewRuler: {
			color: themeColorFromId(overviewRulerFindMatchForeground),
			position: OverviewRulerLane.Center
		}
	});

	private static readonly _RANGE_HIGHLIGHT_DECORATION = ModelDecorationOptions.register({
		stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		className: 'rangeHighlight',
		isWholeLine: false
	});

	private static readonly _FIND_SCOPE_DECORATION = ModelDecorationOptions.register({
		className: 'findScope',
		isWholeLine: true
	});
}
